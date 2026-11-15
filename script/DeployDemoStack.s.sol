// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { Script, console } from "forge-std/Script.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { DemoVault } from "../src/demo/DemoVault.sol";
import { MockToken } from "../src/demo/MockToken.sol";

/// @notice Deploys the demo "protocol" on Base Sepolia: a faucet token, a TimelockController with a short
///         delay, and an ERC-4626 vault owned by that timelock. The deployer is the timelock's only
///         proposer and executor, so the same key can queue the hostile change for the demo.
/// @dev    forge script script/DeployDemoStack.s.sol --rpc-url base_sepolia --broadcast
contract DeployDemoStack is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        uint256 delay = vm.envOr("DEMO_TIMELOCK_DELAY", uint256(300));
        address deployer = vm.addr(key);

        address[] memory operators = new address[](1);
        operators[0] = deployer;

        vm.startBroadcast(key);
        MockToken token = new MockToken();
        TimelockController timelock = new TimelockController(delay, operators, operators, address(0));
        DemoVault vault = new DemoVault(IERC20(address(token)), address(timelock), deployer);
        vm.stopBroadcast();

        console.log("DEMO_TOKEN_ADDR=%s", address(token));
        console.log("DEMO_TIMELOCK_ADDR=%s", address(timelock));
        console.log("DEMO_VAULT_ADDR=%s", address(vault));
    }
}
