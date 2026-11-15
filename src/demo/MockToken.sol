// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet-only token with an open faucet. Demo scaffolding, not part of the product.
contract MockToken is ERC20 {
    uint256 public constant MAX_MINT = 10_000 ether;

    error MintTooLarge(uint256 requested, uint256 max);

    constructor() ERC20("Demo Dollar", "dUSD") { }

    /// @notice Mint up to 10,000 dUSD to any address.
    function mint(address to_, uint256 amount_) external {
        if (amount_ > MAX_MINT) revert MintTooLarge(amount_, MAX_MINT);
        _mint(to_, amount_);
    }
}
