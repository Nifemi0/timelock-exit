// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title DemoVault
 * @notice Testnet stand-in for "a protocol you deposited into". A plain ERC-4626 vault whose owner (meant
 *         to be a TimelockController) can change the exit fee. Raising that fee to 99% is the hostile
 *         change the demo queues, and the one Timelock Exit gets the depositor out ahead of.
 * @dev    Demo scaffolding, not part of the product. ExitGuard works with any ERC-4626 vault.
 */
contract DemoVault is ERC4626, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_EXIT_FEE_BPS = 9_900;

    /// @notice Share of every withdrawal kept by the treasury, in basis points.
    uint256 public exitFeeBps;
    /// @notice Where exit fees go.
    address public treasury;

    error FeeTooHigh(uint256 requested, uint256 max);

    event ExitFeeChanged(uint256 previousBps, uint256 newBps);
    event TreasuryChanged(address previousTreasury, address newTreasury);

    constructor(IERC20 asset_, address owner_, address treasury_)
        ERC20("Demo Vault Share", "dvUSD")
        ERC4626(asset_)
        Ownable(owner_)
    {
        treasury = treasury_;
    }

    // ---------------------------------------------------------------------
    // Governance (owner = timelock)
    // ---------------------------------------------------------------------

    function setExitFee(uint256 newBps_) external onlyOwner {
        if (newBps_ > MAX_EXIT_FEE_BPS) revert FeeTooHigh(newBps_, MAX_EXIT_FEE_BPS);
        emit ExitFeeChanged(exitFeeBps, newBps_);
        exitFeeBps = newBps_;
    }

    function setTreasury(address newTreasury_) external onlyOwner {
        emit TreasuryChanged(treasury, newTreasury_);
        treasury = newTreasury_;
    }

    // ---------------------------------------------------------------------
    // ERC-4626 with an exit fee taken out of the redeemed assets
    // ---------------------------------------------------------------------

    /// @dev Net assets received for burning `shares_`.
    function previewRedeem(uint256 shares_) public view override returns (uint256) {
        uint256 gross = super.previewRedeem(shares_);
        return gross - _feeOn(gross);
    }

    /// @dev Shares that must be burned to receive `assets_` net of the fee.
    function previewWithdraw(uint256 assets_) public view override returns (uint256) {
        uint256 gross = Math.mulDiv(assets_, BPS, BPS - exitFeeBps, Math.Rounding.Ceil);
        return super.previewWithdraw(gross);
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        return previewRedeem(balanceOf(owner_));
    }

    function _withdraw(address caller_, address receiver_, address owner_, uint256 assets_, uint256 shares_)
        internal
        override
    {
        // Value of the shares before they are burned; the gap to `assets_` is the fee.
        uint256 gross = _convertToAssets(shares_, Math.Rounding.Floor);
        uint256 fee = gross > assets_ ? gross - assets_ : 0;

        super._withdraw(caller_, receiver_, owner_, assets_, shares_);

        if (fee > 0 && treasury != address(0) && treasury != address(this)) {
            IERC20(asset()).safeTransfer(treasury, fee);
        }
    }

    function _feeOn(uint256 gross_) private view returns (uint256) {
        return Math.mulDiv(gross_, exitFeeBps, BPS, Math.Rounding.Ceil);
    }
}
