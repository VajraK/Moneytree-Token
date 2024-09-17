// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TaxMoneytreeToken is ERC20, Ownable {
    uint256 public taxRate; // Tax rate in basis points (e.g., 100 = 1%)
    address public taxCollector; // Address where taxes will be collected

    // Events to emit when tax rate is updated
    event TaxRateUpdated(uint256 newTaxRate);
    event TaxCollectorUpdated(address newCollector);

    constructor(
        uint256 initialSupply
    ) ERC20("MoneytreeToken", "MT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
        taxCollector = msg.sender; // By default, the tax collector is the owner
        taxRate = 100; // Initial tax rate (e.g., 100 basis points = 1%)
    }

    /**
     * @dev Override the transfer function to apply a tax.
     * Ensures that if the tax amount is zero due to rounding,
     * the entire amount is transferred without applying the tax.
     * @param recipient The address receiving the tokens.
     * @param amount The amount of tokens to transfer.
     */
    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        uint256 taxAmount = (amount * taxRate) / 10000;
        uint256 amountAfterTax = amount - taxAmount;

        // If the tax amount is zero due to rounding, bypass the tax.
        if (taxAmount == 0) {
            return super.transfer(recipient, amount);
        }

        // Transfer the tax to the taxCollector
        super.transfer(taxCollector, taxAmount);

        // Transfer the remaining amount to the recipient
        return super.transfer(recipient, amountAfterTax);
    }

    /**
     * @dev Override the transferFrom function to apply a tax.
     * Ensures that if the tax amount is zero due to rounding,
     * the entire amount is transferred without applying the tax.
     * @param sender The address sending the tokens.
     * @param recipient The address receiving the tokens.
     * @param amount The amount of tokens to transfer.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        uint256 taxAmount = (amount * taxRate) / 10000;
        uint256 amountAfterTax = amount - taxAmount;

        // If the tax amount is zero due to rounding, bypass the tax.
        if (taxAmount == 0) {
            return super.transferFrom(sender, recipient, amount);
        }

        // Transfer the tax to the taxCollector
        super.transferFrom(sender, taxCollector, taxAmount);

        // Transfer the remaining amount to the recipient
        return super.transferFrom(sender, recipient, amountAfterTax);
    }

    /**
     * @dev Allows the owner to update the tax rate.
     * Limits the maximum tax rate to 20% (2000 basis points).
     * @param newTaxRate The new tax rate in basis points.
     */
    function setTaxRate(uint256 newTaxRate) external onlyOwner {
        require(newTaxRate <= 2000, "Tax rate too high"); // Maximum 20% tax
        taxRate = newTaxRate;
        emit TaxRateUpdated(newTaxRate);
    }

    /**
     * @dev Allows the owner to update the tax collector address.
     * @param newCollector The new address to collect taxes.
     */
    function setTaxCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid tax collector address");
        taxCollector = newCollector;
        emit TaxCollectorUpdated(newCollector);
    }
}
