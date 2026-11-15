// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { Test, Vm } from "forge-std/Test.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPayable } from "@reactive/src/interfaces/IPayable.sol";
import { IReactive } from "@reactive/src/interfaces/IReactive.sol";
import { AbstractPayer } from "@reactive/src/base/AbstractPayer.sol";
import { AbstractCallback } from "@reactive/src/base/AbstractCallback.sol";

import { ExitGuard } from "../src/ExitGuard.sol";
import { TimelockSentinel } from "../src/TimelockSentinel.sol";
import { DemoVault } from "../src/demo/DemoVault.sol";
import { MockToken } from "../src/demo/MockToken.sol";
import { MockSystem } from "./mocks/MockSystem.sol";

/// @notice End-to-end tests for Timelock Exit. Both "chains" live in one EVM here; the test plays the
///         part of Reactive Network by delivering subscribed logs to the sentinel and then delivering the
///         callbacks it requests, exactly as the callback proxy would.
contract TimelockExitTest is Test {
    address internal constant SYSTEM_ADDR = 0x8888888888888888888888888888888888888888;
    uint256 internal constant DEST_CHAIN = 84532;
    uint256 internal constant DELAY = 2 days;
    uint256 internal constant DEPOSIT = 1_000 ether;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal callbackProxy = makeAddr("callbackProxy");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    MockSystem internal system;
    MockToken internal token;
    TimelockController internal timelock;
    DemoVault internal vault;
    TimelockSentinel internal sentinel;
    ExitGuard internal exitGuard;

    uint256 internal deliveredCallbacks;

    function setUp() public {
        vm.etch(SYSTEM_ADDR, address(new MockSystem()).code);
        system = MockSystem(payable(SYSTEM_ADDR));

        address[] memory operators = new address[](1);
        operators[0] = admin;

        token = new MockToken();
        timelock = new TimelockController(DELAY, operators, operators, address(0));
        vault = new DemoVault(IERC20(address(token)), address(timelock), treasury);

        // Same order as a real deployment: sentinel, then guard, then link them.
        vm.prank(admin);
        sentinel = new TimelockSentinel(DEST_CHAIN);
        exitGuard = new ExitGuard(IPayable(payable(callbackProxy)), address(sentinel));
        vm.prank(admin);
        sentinel.setExitGuard(address(exitGuard));

        _deposit(alice, DEPOSIT);
        _deposit(bob, DEPOSIT);

        vm.recordLogs();
    }

    // ---------------------------------------------------------------------
    // The full loop
    // ---------------------------------------------------------------------

    function test_FullLoop_ExitsBeforeHostileChangeExecutes() public {
        _arm(alice, true, new bytes4[](0));
        _relayLogs();

        assertTrue(sentinel.watching(address(timelock)), "timelock should be watched");
        assertTrue(sentinel.isGuarded(address(timelock), alice, address(vault)), "guard should be mirrored");

        // Governance queues a 99% exit fee.
        bytes memory hostile = abi.encodeCall(DemoVault.setExitFee, (9_900));
        bytes32 id = _schedule(address(vault), hostile);
        _relayLogs();

        assertEq(system.callbackCount(), 1, "one exit should be requested");
        _deliverCallbacks();

        // Alice is out, in full, while the change is still pending.
        assertTrue(timelock.isOperationPending(id), "operation should still be pending");
        assertEq(vault.balanceOf(alice), 0, "alice should hold no shares");
        assertEq(token.balanceOf(alice), DEPOSIT, "alice should have her full deposit back");

        // The change lands. Bob had no guard and now pays 99% to leave.
        vm.warp(block.timestamp + DELAY);
        vm.prank(admin);
        timelock.execute(address(vault), 0, hostile, bytes32(0), bytes32(0));

        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);
        assertEq(token.balanceOf(bob), DEPOSIT / 100, "bob should keep 1% after the fee");
    }

    // ---------------------------------------------------------------------
    // Rule matching
    // ---------------------------------------------------------------------

    function test_SelectorRule_MatchesCallOnAnotherTarget() public {
        // Alice only cares about ownership transfers, wherever they are aimed.
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = bytes4(keccak256("transferOwnership(address)"));
        _arm(alice, false, selectors);
        _relayLogs();

        address elsewhere = makeAddr("proxyAdmin");
        _schedule(elsewhere, abi.encodeWithSelector(selectors[0], makeAddr("newOwner")));
        _relayLogs();

        assertEq(system.callbackCount(), 1, "selector rule should match on any target");
        _deliverCallbacks();
        assertEq(token.balanceOf(alice), DEPOSIT);
    }

    function test_SelectorRule_IgnoresOtherSelectorsOnVault() public {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = DemoVault.setExitFee.selector;
        _arm(alice, false, selectors);
        _relayLogs();

        // A treasury change is not what Alice asked to be protected from.
        _schedule(address(vault), abi.encodeCall(DemoVault.setTreasury, (makeAddr("newTreasury"))));
        _relayLogs();

        assertEq(system.callbackCount(), 0, "non-matching selector must not trigger an exit");
        assertEq(vault.balanceOf(alice), DEPOSIT);
    }

    function test_AnyCallRule_IgnoresCallsToOtherTargets() public {
        _arm(alice, true, new bytes4[](0));
        _relayLogs();

        _schedule(makeAddr("unrelated"), abi.encodeCall(DemoVault.setExitFee, (9_900)));
        _relayLogs();

        assertEq(system.callbackCount(), 0, "calls to other contracts must not trigger an exit");
    }

    function test_Batch_RequestsOneExitPerOperation() public {
        _arm(alice, true, new bytes4[](0));
        _relayLogs();

        address[] memory targets = new address[](2);
        uint256[] memory values = new uint256[](2);
        bytes[] memory payloads = new bytes[](2);
        targets[0] = address(vault);
        targets[1] = address(vault);
        payloads[0] = abi.encodeCall(DemoVault.setExitFee, (9_900));
        payloads[1] = abi.encodeCall(DemoVault.setTreasury, (admin));

        vm.prank(admin);
        timelock.scheduleBatch(targets, values, payloads, bytes32(0), bytes32(0), DELAY);
        _relayLogs();

        assertEq(system.callbackCount(), 1, "two matching calls in one batch need only one exit");
    }

    function test_TwoGuards_BothExit() public {
        _arm(alice, true, new bytes4[](0));
        _arm(bob, true, new bytes4[](0));
        _relayLogs();
        assertEq(sentinel.guardCount(address(timelock)), 2);

        _schedule(address(vault), abi.encodeCall(DemoVault.setExitFee, (9_900)));
        _relayLogs();
        _deliverCallbacks();

        assertEq(token.balanceOf(alice), DEPOSIT);
        assertEq(token.balanceOf(bob), DEPOSIT);
    }

    // ---------------------------------------------------------------------
    // Registry sync
    // ---------------------------------------------------------------------

    function test_Disarm_RemovesGuardAndUnsubscribes() public {
        _arm(alice, true, new bytes4[](0));
        _relayLogs();

        vm.prank(alice);
        exitGuard.disarm(address(vault));
        _relayLogs();

        assertFalse(sentinel.isGuarded(address(timelock), alice, address(vault)));
        assertFalse(sentinel.watching(address(timelock)), "last guard leaving should unwatch the timelock");
        assertEq(sentinel.guardCount(address(timelock)), 0);

        _schedule(address(vault), abi.encodeCall(DemoVault.setExitFee, (9_900)));
        _relayLogs();
        assertEq(system.callbackCount(), 0, "a disarmed guard must not exit");
    }

    function test_Disarm_KeepsOtherGuardsIntact() public {
        _arm(alice, true, new bytes4[](0));
        _arm(bob, true, new bytes4[](0));
        _relayLogs();

        vm.prank(alice);
        exitGuard.disarm(address(vault));
        _relayLogs();

        assertTrue(sentinel.watching(address(timelock)));
        assertTrue(sentinel.isGuarded(address(timelock), bob, address(vault)));
        (address user,,,) = sentinel.guardAt(address(timelock), 0);
        assertEq(user, bob, "bob should have been moved into the freed slot");
    }

    function test_Rearm_UpdatesRuleInPlace() public {
        _arm(alice, true, new bytes4[](0));
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = DemoVault.setTreasury.selector;
        _arm(alice, false, selectors);
        _relayLogs();

        assertEq(sentinel.guardCount(address(timelock)), 1, "re-arming must not duplicate the guard");
        (,, bool anyCall, bytes4[] memory stored) = sentinel.guardAt(address(timelock), 0);
        assertFalse(anyCall);
        assertEq(stored.length, 1);
        assertEq(stored[0], DemoVault.setTreasury.selector);
    }

    // ---------------------------------------------------------------------
    // Exit edge cases
    // ---------------------------------------------------------------------

    function test_Exit_SkipsWhenSharesNotApproved() public {
        vm.prank(alice);
        vault.approve(address(exitGuard), 0);
        _arm(alice, true, new bytes4[](0));
        _relayLogs();

        _schedule(address(vault), abi.encodeCall(DemoVault.setExitFee, (9_900)));
        _relayLogs();
        _deliverCallbacks();

        assertEq(vault.balanceOf(alice), DEPOSIT, "nothing should move without an allowance");
    }

    function test_Exit_RedeemsOnlyUpToAllowance() public {
        vm.prank(alice);
        vault.approve(address(exitGuard), DEPOSIT / 4);
        _arm(alice, true, new bytes4[](0));
        _relayLogs();

        _schedule(address(vault), abi.encodeCall(DemoVault.setExitFee, (9_900)));
        _relayLogs();
        _deliverCallbacks();

        assertEq(token.balanceOf(alice), DEPOSIT / 4);
        assertEq(vault.balanceOf(alice), DEPOSIT - DEPOSIT / 4);
    }

    // ---------------------------------------------------------------------
    // Authorization
    // ---------------------------------------------------------------------

    function test_React_RejectsCallersOtherThanSystem() public {
        IReactive.LogRecord memory record;
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), SYSTEM_ADDR));
        sentinel.react(record);
    }

    function test_Exit_RejectsCallersOtherThanProxy() public {
        vm.expectRevert(abi.encodeWithSelector(AbstractPayer.NotAuthorized.selector, address(this), callbackProxy));
        exitGuard.exit(address(sentinel), alice, address(vault), bytes32(0));
    }

    function test_Exit_RejectsOtherReactiveContracts() public {
        address impostor = makeAddr("impostor");
        vm.prank(callbackProxy);
        vm.expectRevert(
            abi.encodeWithSelector(AbstractCallback.CallbackNotAuthorized.selector, impostor, address(sentinel))
        );
        exitGuard.exit(impostor, alice, address(vault), bytes32(0));
    }

    function test_SetExitGuard_OnlyOwnerAndOnlyOnce() public {
        vm.expectRevert(TimelockSentinel.NotOwner.selector);
        sentinel.setExitGuard(address(1));

        vm.prank(admin);
        vm.expectRevert(TimelockSentinel.ExitGuardAlreadySet.selector);
        sentinel.setExitGuard(address(1));
    }

    function test_Arm_ValidatesInput() public {
        bytes4[] memory none = new bytes4[](0);

        vm.expectRevert(ExitGuard.EmptyRule.selector);
        exitGuard.arm(address(vault), address(timelock), false, none);

        vm.expectRevert(ExitGuard.ZeroAddress.selector);
        exitGuard.arm(address(0), address(timelock), true, none);

        bytes4[] memory tooMany = new bytes4[](9);
        vm.expectRevert(abi.encodeWithSelector(ExitGuard.TooManySelectors.selector, 9, 8));
        exitGuard.arm(address(vault), address(timelock), true, tooMany);
    }

    // ---------------------------------------------------------------------
    // Helpers: the test stands in for users and for Reactive Network
    // ---------------------------------------------------------------------

    function _deposit(address user_, uint256 amount_) internal {
        token.mint(user_, amount_);
        vm.startPrank(user_);
        token.approve(address(vault), amount_);
        vault.deposit(amount_, user_);
        vault.approve(address(exitGuard), type(uint256).max);
        vm.stopPrank();
    }

    function _arm(address user_, bool anyCallToVault_, bytes4[] memory selectors_) internal {
        vm.prank(user_);
        exitGuard.arm(address(vault), address(timelock), anyCallToVault_, selectors_);
    }

    function _schedule(address target_, bytes memory data_) internal returns (bytes32 id) {
        id = timelock.hashOperation(target_, 0, data_, bytes32(0), bytes32(0));
        vm.prank(admin);
        timelock.schedule(target_, 0, data_, bytes32(0), bytes32(0), DELAY);
    }

    /// @dev Deliver every recorded log the sentinel is subscribed to, as the system contract would.
    function _relayLogs() internal {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; ++i) {
            Vm.Log memory entry = logs[i];
            if (entry.topics.length == 0) continue;
            if (!system.isSubscribed(address(sentinel), DEST_CHAIN, entry.emitter, uint256(entry.topics[0]))) continue;

            vm.prank(SYSTEM_ADDR);
            sentinel.react(_toRecord(entry));
        }
    }

    /// @dev Deliver every pending callback, as the callback proxy would: overwrite the first argument
    ///      with the requesting reactive contract's address, then call the recipient.
    function _deliverCallbacks() internal {
        uint256 total = system.callbackCount();
        for (; deliveredCallbacks < total; ++deliveredCallbacks) {
            MockSystem.CallbackRequest memory request = system.callbackAt(deliveredCallbacks);
            assertEq(request.chainId, DEST_CHAIN, "callback should target the destination chain");
            assertEq(request.recipient, address(exitGuard), "callback should target ExitGuard");

            bytes memory payload = request.payload;
            address requester = request.requester;
            assembly {
                // 32-byte length word, 4-byte selector, then the first argument.
                mstore(add(payload, 36), requester)
            }

            vm.prank(callbackProxy);
            (bool ok,) = request.recipient.call{ gas: request.gasLimit }(payload);
            assertTrue(ok, "callback should not revert");
        }
    }

    function _toRecord(Vm.Log memory entry_) internal view returns (IReactive.LogRecord memory record) {
        uint256 topicCount = entry_.topics.length;
        record.chainId = DEST_CHAIN;
        record.contractAddress = entry_.emitter;
        record.opCode = topicCount;
        if (topicCount > 0) record.topic0 = uint256(entry_.topics[0]);
        if (topicCount > 1) record.topic1 = uint256(entry_.topics[1]);
        if (topicCount > 2) record.topic2 = uint256(entry_.topics[2]);
        if (topicCount > 3) record.topic3 = uint256(entry_.topics[3]);
        record.data = entry_.data;
        record.blockNumber = block.number;
    }
}
