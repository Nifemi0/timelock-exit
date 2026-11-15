// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { ISystemContract } from "@reactive/src/interfaces/ISystemContract.sol";

/// @notice Test double for Reactive Network's system contract. Its code is etched at the real system
///         address so TimelockSentinel talks to it unmodified. It records subscriptions and callback
///         requests so tests can play the network's part: deliver subscribed logs, then deliver callbacks.
contract MockSystem {
    struct CallbackRequest {
        uint256 chainId;
        address recipient;
        uint64 gasLimit;
        bytes payload;
        address requester;
    }

    CallbackRequest[] private _callbacks;
    mapping(bytes32 => uint256) private _subscriptions;

    receive() external payable { }

    function debt(address) external pure returns (uint256) {
        return 0;
    }

    function subscribe(uint256 chainId_, address contract_, uint256 topic0_, uint256, uint256, uint256) external {
        _subscriptions[_subKey(msg.sender, chainId_, contract_, topic0_)] += 1;
    }

    function unsubscribe(uint256 chainId_, address contract_, uint256 topic0_, uint256, uint256, uint256) external {
        bytes32 key = _subKey(msg.sender, chainId_, contract_, topic0_);
        if (_subscriptions[key] > 0) _subscriptions[key] -= 1;
    }

    function requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0 memory config_) external {
        _callbacks.push(
            CallbackRequest({
                chainId: config_.chainId,
                recipient: config_.recipient,
                gasLimit: config_.gasLimit,
                payload: config_.payload,
                requester: msg.sender
            })
        );
    }

    // --- test helpers ---

    function isSubscribed(address subscriber_, uint256 chainId_, address contract_, uint256 topic0_)
        external
        view
        returns (bool)
    {
        return _subscriptions[_subKey(subscriber_, chainId_, contract_, topic0_)] > 0;
    }

    function callbackCount() external view returns (uint256) {
        return _callbacks.length;
    }

    function callbackAt(uint256 index_) external view returns (CallbackRequest memory) {
        return _callbacks[index_];
    }

    function _subKey(address subscriber_, uint256 chainId_, address contract_, uint256 topic0_)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(subscriber_, chainId_, contract_, topic0_));
    }
}
