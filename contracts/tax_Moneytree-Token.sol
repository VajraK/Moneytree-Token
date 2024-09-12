// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TaxMoneytreeToken is ERC20, Ownable {
    uint256 public taxRate; // Tax rate in basis points (e.g., 100 = 1%)
    address public taxCollector; // Address where taxes will be collected

    // Events to emit when tax rate is updated
    event TaxRateUpdated(uint256 newTaxRate);

    constructor(
        uint256 initialSupply
    ) ERC20("MoneytreeToken", "MT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
        taxCollector = msg.sender; // By default, the tax collector is the owner
        taxRate = 100; // Initial tax rate (e.g., 100 basis points = 1%)
    }

    // Override the transfer function to apply tax
    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        uint256 taxAmount = (amount * taxRate) / 10000; // Calculate tax
        uint256 amountAfterTax = amount - taxAmount;

        // Transfer the tax to the taxCollector
        super.transfer(taxCollector, taxAmount);

        // Transfer the remaining amount to the recipient
        return super.transfer(recipient, amountAfterTax);
    }

    // Override the transferFrom function to apply tax
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        uint256 taxAmount = (amount * taxRate) / 10000; // Calculate tax
        uint256 amountAfterTax = amount - taxAmount;

        // Transfer the tax to the taxCollector
        super.transferFrom(sender, taxCollector, taxAmount);

        // Transfer the remaining amount to the recipient
        return super.transferFrom(sender, recipient, amountAfterTax);
    }

    // Function to update the tax rate (onlyOwner)
    function setTaxRate(uint256 newTaxRate) external onlyOwner {
        require(newTaxRate <= 1000, "Tax rate too high"); // Limit to a max of 10%
        taxRate = newTaxRate;
        emit TaxRateUpdated(newTaxRate);
    }

    // Function to change the tax collector (onlyOwner)
    function setTaxCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid tax collector address");
        taxCollector = newCollector;
    }
}
