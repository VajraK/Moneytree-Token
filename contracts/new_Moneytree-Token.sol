// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

contract MoneytreeToken is ERC20, Ownable {
    uint256 public taxRate; // Tax rate in basis points (e.g., 100 = 1%)
    address public taxCollector; // Address where taxes will be collected
    uint256 public swapTokensAtAmount; // Minimum token amount before swapping for ETH
    IUniswapV2Router02 public uniswapV2Router;
    bool public swapEnabled = false; // Flag for enabling swaps
    bool private swapping;

    // Accumulate tokens for tax
    uint256 public tokensForTax;

    // Slippage tolerance for swaps (percentage, e.g., 1 = 1%)
    uint256 public slippageTolerance = 1; // Default slippage tolerance is 1%

    // List of addresses exempt from paying taxes
    mapping(address => bool) public isTaxExempt;

    event TaxRateUpdated(uint256 newTaxRate);
    event TaxCollectorUpdated(address newCollector);
    event SwapAndSendTax(uint256 tokensSwapped, uint256 ethSent);
    event SwapEnabledUpdated(bool enabled);
    event SwapTokensAtAmountUpdated(uint256 newAmount);
    event SetSlippageToleranceUpdated(uint256 newSlippage);
    event TaxExemptionUpdated(address indexed account, bool isExempt);

    constructor(
        uint256 initialSupply,
        address routerAddress
    ) ERC20("MoneytreeToken", "MT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
        taxCollector = msg.sender; // Set tax collector to contract owner by default
        taxRate = 100; // Set initial tax rate to 1% (100 basis points)

        // Initialize Uniswap V2 Router
        uniswapV2Router = IUniswapV2Router02(routerAddress);

        // Set the minimum amount of tokens before swapping for ETH (e.g., 500 tokens)
        swapTokensAtAmount = (initialSupply * 5) / 10000; // 0.05% of total supply

        // By default, the owner is exempt from taxes
        isTaxExempt[owner()] = true;

        // Exempt the contract itself from taxes
        isTaxExempt[address(this)] = true;

        // Exempt the Uniswap router from taxes
        isTaxExempt[routerAddress] = true;
    }

    receive() external payable {}

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
        // Check if sender or recipient is tax exempt
        if (isTaxExempt[sender] || isTaxExempt[recipient]) {
            // Perform a normal transfer if tax exempt
            super._transfer(sender, recipient, amount);
            return true;
        }

        uint256 taxAmount = (amount * taxRate) / 10000;
        uint256 amountAfterTax = amount - taxAmount;

        // Add tokens to tax pool (inside contract)
        if (taxAmount > 0) {
            tokensForTax += taxAmount;
            super._transfer(sender, address(this), taxAmount); // Send tax to contract
        }

        // Transfer remaining amount to recipient
        super._transfer(sender, recipient, amountAfterTax);

        // Check if conditions are met for swapping tax tokens for ETH
        if (tokensForTax >= swapTokensAtAmount && !swapping && swapEnabled) {
            swapping = true;
            swapAndSendTax();
            swapping = false;
        }

        return true;
    }

    // Function to swap tokens for ETH using Uniswap
    function swapTokensForEth(uint256 tokenAmount) private {
        // Generate the Uniswap pair path of token -> WETH
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // Get the estimated amount of ETH from Uniswap
        uint256[] memory amountsOut = uniswapV2Router.getAmountsOut(
            tokenAmount,
            path
        );
        uint256 amountOutMin = (amountsOut[1] * (100 - slippageTolerance)) /
            100;

        // Make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            amountOutMin, // Accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );

        _approve(address(this), address(uniswapV2Router), 0);
    }

    // Swap accumulated tokens for ETH and send to tax collector
    function swapAndSendTax() private {
        uint256 contractBalance = balanceOf(address(this));

        // If there's not enough balance to swap, do nothing
        if (contractBalance == 0 || tokensForTax == 0) {
            return;
        }

        // Swap tokens for ETH
        uint256 initialETHBalance = address(this).balance;
        swapTokensForEth(contractBalance);
        uint256 newETHBalance = address(this).balance - initialETHBalance;

        // Transfer ETH to tax collector
        (bool success, ) = taxCollector.call{value: newETHBalance}("");
        require(success, "ETH transfer to tax collector failed");

        // Reset tax tokens
        tokensForTax = 0;

        emit SwapAndSendTax(contractBalance, newETHBalance);
    }

    // Enable or disable swaps
    function setSwapEnabled(bool enabled) external onlyOwner {
        swapEnabled = enabled;
        emit SwapEnabledUpdated(enabled);
    }

    // Set minimum tokens required for swap
    function setSwapTokensAtAmount(uint256 newAmount) external onlyOwner {
        swapTokensAtAmount = newAmount;
        emit SwapTokensAtAmountUpdated(newAmount);
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

    // Set slippage tolerance for swaps
    function setSlippageTolerance(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 10, "Slippage tolerance too high"); // Max 10%
        slippageTolerance = newSlippage;
        emit SetSlippageToleranceUpdated(newSlippage);
    }

    // Exempt an address from tax
    function setTaxExemption(address account, bool exempt) external onlyOwner {
        isTaxExempt[account] = exempt;
        emit TaxExemptionUpdated(account, exempt);
    }

    // Withdraw any ETH stuck in the contract
    function emergencyWithdrawETH() external onlyOwner {
        uint256 contractETHBalance = address(this).balance;
        (bool success, ) = owner().call{value: contractETHBalance}("");
        require(success, "Emergency ETH withdrawal failed");
    }
}
