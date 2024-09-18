// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MoneytreeToken is ERC20, Ownable {
    uint256 public taxRate; // Tax rate in basis points (e.g., 100 = 1%)
    address public taxCollector; // Address where taxes will be collected

    // List of addresses exempt from paying taxes
    mapping(address => bool) public isTaxExempt;

    event TaxRateUpdated(uint256 newTaxRate);
    event TaxCollectorUpdated(address newCollector);
    event TaxExemptionUpdated(address indexed account, bool isExempt);

    constructor(
        uint256 initialSupply
    ) ERC20("MoneytreeToken", "MT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
        taxCollector = msg.sender; // Set tax collector to contract owner by default
        taxRate = 100; // Set initial tax rate to 1% (100 basis points)

        // Exempt addresses from taxes
        isTaxExempt[owner()] = true; // Owner is exempt
        isTaxExempt[address(this)] = true; // Contract is exempt
    }

    // Override transfer function to apply tax logic
    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        return _taxedTransfer(_msgSender(), recipient, amount);
    }

    // Override transferFrom function to apply tax logic
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        uint256 currentAllowance = allowance(sender, _msgSender());
        require(
            currentAllowance >= amount,
            "ERC20: transfer amount exceeds allowance"
        );
        _approve(sender, _msgSender(), currentAllowance - amount);

        return _taxedTransfer(sender, recipient, amount);
    }

    function _taxedTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) private returns (bool) {
        // Check if sender or recipient is tax-exempt
        if (isTaxExempt[sender] || isTaxExempt[recipient]) {
            // Perform a normal transfer if tax-exempt
            super._transfer(sender, recipient, amount);
            return true;
        }

        uint256 taxAmount = 0;

        // Apply tax on all transfers except exempted addresses
        if (taxRate > 0) {
            taxAmount = (amount * taxRate) / 10000;
        }

        uint256 amountAfterTax = amount - taxAmount;

        // Transfer tax amount to taxCollector
        if (taxAmount > 0) {
            super._transfer(sender, taxCollector, taxAmount);
        }

        // Transfer remaining amount to recipient
        super._transfer(sender, recipient, amountAfterTax);

        return true;
    }

    // Set the tax rate (maximum 20%)
    function setTaxRate(uint256 newTaxRate) external onlyOwner {
        require(newTaxRate <= 2000, "Tax rate too high");
        taxRate = newTaxRate;
        emit TaxRateUpdated(newTaxRate);
    }

    // Set the tax collector address
    function setTaxCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid tax collector address");
        taxCollector = newCollector;
        emit TaxCollectorUpdated(newCollector);
    }

    // Exempt an address from tax
    function setTaxExemption(address account, bool exempt) external onlyOwner {
        isTaxExempt[account] = exempt;
        emit TaxExemptionUpdated(account, exempt);
    }
}
