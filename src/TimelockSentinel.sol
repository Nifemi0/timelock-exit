// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { ISystemContract } from "@reactive/src/interfaces/ISystemContract.sol";
import { IReactive } from "@reactive/src/interfaces/IReactive.sol";
import { AbstractReactive } from "@reactive/src/base/AbstractReactive.sol";

/// @dev The one function TimelockSentinel calls on the destination chain.
interface IExitGuardCallback {
    function exit(address sentinel_, address user_, address vault_, bytes32 operationId_) external;
}

/**
 * @title TimelockSentinel
 * @notice Reactive-Network half of Timelock Exit. It does two jobs, both driven purely by events:
 *
 *         1. Registry sync. It subscribes to ExitGuard's `GuardArmed` / `GuardDisarmed` events on the
 *            destination chain and mirrors them into its own storage, so depositors never have to send a
 *            transaction on Reactive Network. The first guard for a timelock subscribes to that timelock;
 *            the last one leaving unsubscribes.
 *
 *         2. Queue watching. It subscribes to `CallScheduled` on every watched TimelockController. When a
 *            queued operation matches a depositor's rule, it requests an `exit()` callback for them.
 *
 * @dev    Deployment order (the callback sender on ExitGuard is immutable, so the cycle breaks here):
 *         deploy TimelockSentinel, deploy ExitGuard with this address, then call `setExitGuard`.
 */
contract TimelockSentinel is AbstractReactive {
    /// @dev OpenZeppelin TimelockController. `id` and `index` are indexed, the rest is in `data`.
    uint256 private constant CALL_SCHEDULED_TOPIC0 =
        uint256(keccak256("CallScheduled(bytes32,uint256,address,uint256,bytes,bytes32,uint256)"));
    uint256 private constant GUARD_ARMED_TOPIC0 = uint256(keccak256("GuardArmed(address,address,address,bool,bytes4[])"));
    uint256 private constant GUARD_DISARMED_TOPIC0 = uint256(keccak256("GuardDisarmed(address,address,address)"));

    /// @notice Gas forwarded to ExitGuard.exit() on the destination chain.
    uint64 public constant CALLBACK_GAS_LIMIT = 600_000;

    /// @notice Upper bound on guards per timelock, so one `CallScheduled` can never run out of gas.
    uint256 public constant MAX_GUARDS_PER_TIMELOCK = 50;

    struct Guard {
        address user;
        address vault;
        bool anyCallToVault;
        bytes4[] selectors;
    }

    error NotOwner();
    error ExitGuardAlreadySet();
    error ZeroAddress();

    event ExitGuardSet(address indexed exitGuard);
    event GuardSynced(address indexed timelock, address indexed user, address indexed vault);
    event GuardRemoved(address indexed timelock, address indexed user, address indexed vault);
    event GuardRejected(address indexed timelock, address indexed user, address indexed vault);
    event TimelockWatched(address indexed timelock);
    event TimelockUnwatched(address indexed timelock);
    event ExitRequested(
        address indexed timelock,
        bytes32 indexed operationId,
        address indexed user,
        address vault,
        address target,
        bytes4 selector,
        uint256 delay
    );

    address public immutable OWNER;
    /// @notice Chain that hosts the timelocks, the vaults and ExitGuard.
    uint256 public immutable DESTINATION_CHAIN_ID;

    /// @notice ExitGuard on the destination chain. Set once.
    address public exitGuard;

    /// @notice Whether this contract currently holds a `CallScheduled` subscription for a timelock.
    mapping(address timelock => bool) public watching;

    mapping(address timelock => Guard[]) private _guards;
    /// @dev guard key => index in `_guards[timelock]` plus one (zero means absent).
    mapping(bytes32 key => uint256) private _slot;
    /// @dev operation id => guard key => exit already requested. A batch emits one `CallScheduled` per
    ///      call under a single id; one exit per depositor per operation is enough.
    mapping(bytes32 operationId => mapping(bytes32 key => bool)) private _requested;

    /// @param destinationChainId_ Chain id of the chain hosting ExitGuard (84532 for Base Sepolia).
    constructor(uint256 destinationChainId_) payable {
        OWNER = msg.sender;
        DESTINATION_CHAIN_ID = destinationChainId_;
    }

    // ---------------------------------------------------------------------
    // Setup
    // ---------------------------------------------------------------------

    /// @notice Point the sentinel at ExitGuard and start mirroring its guard registry.
    function setExitGuard(address exitGuard_) external {
        if (msg.sender != OWNER) revert NotOwner();
        if (exitGuard != address(0)) revert ExitGuardAlreadySet();
        if (exitGuard_ == address(0)) revert ZeroAddress();

        exitGuard = exitGuard_;

        SYSTEM.subscribe(
            DESTINATION_CHAIN_ID, exitGuard_, GUARD_ARMED_TOPIC0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
        SYSTEM.subscribe(
            DESTINATION_CHAIN_ID, exitGuard_, GUARD_DISARMED_TOPIC0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );

        emit ExitGuardSet(exitGuard_);
    }

    /// @notice Settle outstanding debt from this contract's balance so event delivery resumes.
    function coverDebt() external {
        _coverDebt();
    }

    // ---------------------------------------------------------------------
    // Event entry point
    // ---------------------------------------------------------------------

    /// @inheritdoc IReactive
    /// @dev Non-matching logs fall through silently. Reverting as a filter would still be billed.
    function react(LogRecord calldata log_) external onlySystem {
        if (log_.chainId != DESTINATION_CHAIN_ID) return;

        address emitter = log_.contractAddress;

        if (emitter == exitGuard) {
            // Both guard events carry three indexed addresses: four topics in total.
            if (log_.opCode != 4) return;

            if (log_.topic0 == GUARD_ARMED_TOPIC0) {
                _onGuardArmed(log_);
            } else if (log_.topic0 == GUARD_DISARMED_TOPIC0) {
                _onGuardDisarmed(log_);
            }
            return;
        }

        // CallScheduled has two indexed fields: three topics in total.
        if (log_.topic0 == CALL_SCHEDULED_TOPIC0 && log_.opCode == 3 && watching[emitter]) {
            _onCallScheduled(log_);
        }
    }

    // ---------------------------------------------------------------------
    // Registry sync
    // ---------------------------------------------------------------------

    function _onGuardArmed(LogRecord calldata log_) internal {
        address user = address(uint160(log_.topic1));
        address vault = address(uint160(log_.topic2));
        address timelock = address(uint160(log_.topic3));
        (bool anyCallToVault, bytes4[] memory selectors) = abi.decode(log_.data, (bool, bytes4[]));

        Guard[] storage list = _guards[timelock];
        bytes32 key = _key(timelock, user, vault);
        uint256 slot = _slot[key];

        Guard storage guard;
        if (slot != 0) {
            guard = list[slot - 1];
        } else {
            if (list.length >= MAX_GUARDS_PER_TIMELOCK) {
                emit GuardRejected(timelock, user, vault);
                return;
            }
            guard = list.push();
            guard.user = user;
            guard.vault = vault;
            _slot[key] = list.length;
        }

        guard.anyCallToVault = anyCallToVault;
        guard.selectors = selectors;

        if (!watching[timelock]) {
            watching[timelock] = true;
            SYSTEM.subscribe(
                DESTINATION_CHAIN_ID, timelock, CALL_SCHEDULED_TOPIC0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
            );
            emit TimelockWatched(timelock);
        }

        emit GuardSynced(timelock, user, vault);
    }

    function _onGuardDisarmed(LogRecord calldata log_) internal {
        address user = address(uint160(log_.topic1));
        address vault = address(uint160(log_.topic2));
        address timelock = address(uint160(log_.topic3));

        bytes32 key = _key(timelock, user, vault);
        uint256 slot = _slot[key];
        if (slot == 0) return;

        Guard[] storage list = _guards[timelock];
        uint256 index = slot - 1;
        uint256 last = list.length - 1;

        if (index != last) {
            Guard storage moved = list[last];
            _slot[_key(timelock, moved.user, moved.vault)] = slot;
            list[index] = moved;
        }
        list.pop();
        delete _slot[key];

        emit GuardRemoved(timelock, user, vault);

        if (list.length == 0 && watching[timelock]) {
            watching[timelock] = false;
            // Must match the subscribe() call above argument for argument, or it silently does nothing.
            SYSTEM.unsubscribe(
                DESTINATION_CHAIN_ID, timelock, CALL_SCHEDULED_TOPIC0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
            );
            emit TimelockUnwatched(timelock);
        }
    }

    // ---------------------------------------------------------------------
    // Queue watching
    // ---------------------------------------------------------------------

    function _onCallScheduled(LogRecord calldata log_) internal {
        address timelock = log_.contractAddress;
        bytes32 operationId = bytes32(log_.topic1);

        (address target,, bytes memory callData,, uint256 delay) =
            abi.decode(log_.data, (address, uint256, bytes, bytes32, uint256));

        bool hasSelector = callData.length >= 4;
        bytes4 selector = hasSelector ? bytes4(callData) : bytes4(0);

        Guard[] storage list = _guards[timelock];
        uint256 count = list.length;

        for (uint256 i = 0; i < count; ++i) {
            Guard storage guard = list[i];
            if (!_matches(guard, target, selector, hasSelector)) continue;

            bytes32 key = _key(timelock, guard.user, guard.vault);
            if (_requested[operationId][key]) continue;
            _requested[operationId][key] = true;

            // The first argument is a placeholder: Reactive Network overwrites it with this
            // contract's address so ExitGuard can authenticate the sender.
            bytes memory payload =
                abi.encodeCall(IExitGuardCallback.exit, (address(0), guard.user, guard.vault, operationId));

            SYSTEM.requestCallbackV_1_0(
                ISystemContract.CallbackConfiguration_V_1_0({
                    chainId: DESTINATION_CHAIN_ID,
                    recipient: exitGuard,
                    gasLimit: CALLBACK_GAS_LIMIT,
                    payload: payload
                })
            );

            emit ExitRequested(timelock, operationId, guard.user, guard.vault, target, selector, delay);
        }
    }

    function _matches(Guard storage guard_, address target_, bytes4 selector_, bool hasSelector_)
        internal
        view
        returns (bool)
    {
        if (guard_.anyCallToVault && target_ == guard_.vault) return true;
        if (!hasSelector_) return false;

        uint256 count = guard_.selectors.length;
        for (uint256 i = 0; i < count; ++i) {
            if (guard_.selectors[i] == selector_) return true;
        }
        return false;
    }

    function _key(address timelock_, address user_, address vault_) internal pure returns (bytes32) {
        return keccak256(abi.encode(timelock_, user_, vault_));
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Number of guards mirrored for `timelock_`.
    function guardCount(address timelock_) external view returns (uint256) {
        return _guards[timelock_].length;
    }

    /// @notice Guard at `index_` in `timelock_`'s list.
    function guardAt(address timelock_, uint256 index_)
        external
        view
        returns (address user, address vault, bool anyCallToVault, bytes4[] memory selectors)
    {
        Guard storage guard = _guards[timelock_][index_];
        return (guard.user, guard.vault, guard.anyCallToVault, guard.selectors);
    }

    /// @notice Whether a guard for (`timelock_`, `user_`, `vault_`) is mirrored here.
    function isGuarded(address timelock_, address user_, address vault_) external view returns (bool) {
        return _slot[_key(timelock_, user_, vault_)] != 0;
    }
}
