// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IPayable } from "@reactive/src/interfaces/IPayable.sol";
import { AbstractCallback } from "@reactive/src/base/AbstractCallback.sol";

/**
 * @title ExitGuard
 * @notice Destination-chain half of Timelock Exit. Depositors register a guard for an ERC-4626 vault and
 *         approve their shares to this contract. When the paired reactive contract (TimelockSentinel) sees a
 *         matching operation queued on the vault's timelock, it calls `exit()` through the Reactive callback
 *         proxy and the depositor's shares are redeemed straight back to them.
 * @dev    This contract never holds user funds. It only spends a share allowance, and always redeems to the
 *         share owner. Its ETH balance is used solely to pay for callback delivery.
 */
contract ExitGuard is AbstractCallback {
    /// @notice Maximum number of function selectors one guard may watch.
    uint256 public constant MAX_SELECTORS = 8;

    /// @notice Why an exit callback did nothing.
    enum SkipReason {
        NotArmed,
        NothingToRedeem,
        RedeemFailed
    }

    struct Guard {
        // Timelock whose queue is being watched.
        address timelock;
        // Exit on any operation that targets the vault itself.
        bool anyCallToVault;
        bool armed;
        // Exit on these selectors no matter which contract the operation targets
        // (e.g. an upgrade routed through a ProxyAdmin).
        bytes4[] selectors;
    }

    error ZeroAddress();
    error TooManySelectors(uint256 given, uint256 max);
    error EmptyRule();
    error NotArmedError();

    /// @dev TimelockSentinel mirrors its registry from these two events. Do not change their shape
    ///      without changing the topic hashes and decoding in TimelockSentinel.
    event GuardArmed(
        address indexed user, address indexed vault, address indexed timelock, bool anyCallToVault, bytes4[] selectors
    );
    event GuardDisarmed(address indexed user, address indexed vault, address indexed timelock);

    event Exited(
        address indexed user, address indexed vault, bytes32 indexed operationId, uint256 shares, uint256 assets
    );
    event ExitSkipped(
        address indexed user, address indexed vault, bytes32 indexed operationId, SkipReason reason
    );

    mapping(address user => mapping(address vault => Guard)) private _guards;

    /// @param callbackProxy_ Reactive callback proxy on this chain.
    /// @param sentinel_ TimelockSentinel address on Reactive Network. Immutable: a wrong value means redeploying.
    constructor(IPayable callbackProxy_, address sentinel_) payable AbstractCallback(callbackProxy_, sentinel_) { }

    // ---------------------------------------------------------------------
    // Depositor actions
    // ---------------------------------------------------------------------

    /// @notice Arm (or replace) the caller's guard for `vault_`.
    /// @dev The caller must also `approve` this contract for their vault shares, otherwise the exit has
    ///      nothing it is allowed to redeem.
    /// @param vault_ ERC-4626 vault holding the caller's position.
    /// @param timelock_ TimelockController that governs the vault.
    /// @param anyCallToVault_ Exit on any queued operation whose target is the vault.
    /// @param selectors_ Exit on these function selectors regardless of target. May be empty if
    ///        `anyCallToVault_` is true.
    function arm(address vault_, address timelock_, bool anyCallToVault_, bytes4[] calldata selectors_) external {
        if (vault_ == address(0) || timelock_ == address(0)) revert ZeroAddress();
        if (selectors_.length > MAX_SELECTORS) revert TooManySelectors(selectors_.length, MAX_SELECTORS);
        if (!anyCallToVault_ && selectors_.length == 0) revert EmptyRule();

        Guard storage guard = _guards[msg.sender][vault_];

        // Re-arming against a different timelock must release the old watch first, so the sentinel's
        // per-timelock registry stays exact.
        if (guard.armed && guard.timelock != timelock_) {
            emit GuardDisarmed(msg.sender, vault_, guard.timelock);
        }

        guard.timelock = timelock_;
        guard.anyCallToVault = anyCallToVault_;
        guard.armed = true;
        guard.selectors = selectors_;

        emit GuardArmed(msg.sender, vault_, timelock_, anyCallToVault_, selectors_);
    }

    /// @notice Remove the caller's guard for `vault_`.
    function disarm(address vault_) external {
        Guard storage guard = _guards[msg.sender][vault_];
        if (!guard.armed) revert NotArmedError();

        address timelock = guard.timelock;
        delete _guards[msg.sender][vault_];

        emit GuardDisarmed(msg.sender, vault_, timelock);
    }

    // ---------------------------------------------------------------------
    // Reactive callback
    // ---------------------------------------------------------------------

    /// @notice Redeem `user_`'s shares in `vault_` back to them. Called by the Reactive callback proxy.
    /// @dev Never reverts on a business condition: a failed callback is still billed, so every non-exit
    ///      outcome is reported through `ExitSkipped` instead.
    /// @param sentinel_ Overwritten by Reactive Network with the requesting reactive contract's address.
    /// @param user_ Share owner to exit.
    /// @param vault_ ERC-4626 vault to redeem from.
    /// @param operationId_ Timelock operation id that triggered the exit, for the audit trail.
    function exit(address sentinel_, address user_, address vault_, bytes32 operationId_)
        external
        onlyServiceProvider
        onlyCallbackSender(sentinel_)
    {
        if (!_guards[user_][vault_].armed) {
            emit ExitSkipped(user_, vault_, operationId_, SkipReason.NotArmed);
            return;
        }

        uint256 shares = redeemableShares(user_, vault_);
        if (shares == 0) {
            emit ExitSkipped(user_, vault_, operationId_, SkipReason.NothingToRedeem);
            return;
        }

        try IERC4626(vault_).redeem(shares, user_, user_) returns (uint256 assets) {
            emit Exited(user_, vault_, operationId_, shares, assets);
        } catch {
            emit ExitSkipped(user_, vault_, operationId_, SkipReason.RedeemFailed);
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Shares this contract could redeem for `user_` right now: the smallest of their balance,
    ///         their allowance to this contract, and the vault's own redeem limit.
    function redeemableShares(address user_, address vault_) public view returns (uint256 shares) {
        IERC4626 vault = IERC4626(vault_);
        shares = vault.balanceOf(user_);

        uint256 allowance = vault.allowance(user_, address(this));
        if (allowance < shares) shares = allowance;

        uint256 limit = vault.maxRedeem(user_);
        if (limit < shares) shares = limit;
    }

    /// @notice The guard `user_` has registered for `vault_`.
    function guardOf(address user_, address vault_)
        external
        view
        returns (address timelock, bool anyCallToVault, bool armed, bytes4[] memory selectors)
    {
        Guard storage guard = _guards[user_][vault_];
        return (guard.timelock, guard.anyCallToVault, guard.armed, guard.selectors);
    }

    // ---------------------------------------------------------------------
    // Funding
    // ---------------------------------------------------------------------

    /// @notice Settle any outstanding callback debt from this contract's balance. Open to anyone, so a
    ///         third party can fund the contract and restart delivery.
    function coverDebt() external {
        _coverDebt();
    }
}
