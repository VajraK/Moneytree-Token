const readline = require("readline");
const fs = require('fs');
const yaml = require('js-yaml');
const ethers = require("ethers");

async function main() {
  // Set up readline to get input from the console
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Helper function to prompt user input
  const askQuestion = (question) => {
    return new Promise((resolve) => rl.question(question, resolve));
  };

  try {
    // Load the YAML configuration file
    const config = yaml.load(fs.readFileSync('./config.yaml', 'utf8'));

    // Prompt for the network (Mainnet or Sepolia)
    let networkChoice = await askQuestion("Choose the network (mainnet or sepolia): ");

    // Determine network
    let network;
    if (networkChoice.toLowerCase() === 'mainnet' || !networkChoice) {
      network = 'mainnet';
    } else if (networkChoice.toLowerCase() === 'sepolia') {
      network = 'sepolia';
    } else {
      throw new Error("Invalid network choice! Please choose 'mainnet' or 'sepolia'.");
    }

    // Extract relevant addresses for the chosen network
    const uniswapRouterAddress = config.SwapRouter[network];
    const infuraApiKey = config.infuraApiKey;
    const privateKey = config.privateKey;

    if (!infuraApiKey || !privateKey) {
      throw new Error("Missing Infura API key or private key in the config.yaml file.");
    }

    // Set up provider and signer
    let provider;
    if (network === 'mainnet') {
      provider = new ethers.providers.InfuraProvider('homestead', infuraApiKey);
    } else {
      provider = new ethers.providers.InfuraProvider('sepolia', infuraApiKey);
    }

    const signer = new ethers.Wallet(privateKey, provider);

    // Get Uniswap V2 router contract instance
    const uniswapRouterAbi = [
      "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
      "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
      "function WETH() external pure returns (address)"
    ];

    const uniswapRouter = new ethers.Contract(uniswapRouterAddress, uniswapRouterAbi, signer);

    // Prompt for the Token address
    let tokenAddress = await askQuestion("Enter the Token contract address you want to buy: ");

    // Validate the token address
    if (!ethers.utils.isAddress(tokenAddress)) {
      throw new Error("Invalid token contract address.");
    }

    // Prompt for the amount of ETH you want to spend
    let ethAmount = await askQuestion("Enter the amount of ETH you want to spend: ");
    if (isNaN(ethAmount) || Number(ethAmount) <= 0) {
      throw new Error("Invalid ETH amount.");
    }

    // Convert ETH amount to BigNumber
    const ethAmountInWei = ethers.utils.parseEther(ethAmount);

    // Set up the token swap path (ETH -> Token)
    const wethAddress = await uniswapRouter.WETH();
    const path = [wethAddress, tokenAddress];

    // Set a slippage tolerance (e.g., 1%)
    const slippageTolerance = 1; // 1%

    // Get the current estimated token amount from Uniswap
    let amountsOut;
    try {
      amountsOut = await uniswapRouter.getAmountsOut(ethAmountInWei, path);
    } catch (error) {
      console.error("Failed to fetch the token amount from Uniswap. Possible reasons could be:");
      console.error("- The token might not have enough liquidity on Uniswap.");
      console.error("- The token address might be invalid or not listed on Uniswap.");
      throw error; // Re-throw the error after logging additional context
    }

    const amountOutMin = amountsOut[1].mul(100 - slippageTolerance).div(100); // Apply slippage tolerance

    // Log the expected token amount (before slippage)
    console.log(`Expected tokens to receive (before slippage): ${ethers.utils.formatUnits(amountsOut[1])}`);

    // Prompt for confirmation
    const confirm = await askQuestion(
      `Do you want to proceed with the transaction to buy ${ethers.utils.formatUnits(amountOutMin)} tokens for ${ethAmount} ETH? (yes/no): `
    );

    if (confirm.toLowerCase() !== "yes") {
      console.log("Transaction cancelled.");
      rl.close();
      return;
    }

    // Retry loop for executing the swap
    let success = false;
    while (!success) {
      try {
        // Execute the swap on Uniswap
        console.log("Attempting to execute the swap...");

        const tx = await uniswapRouter.swapExactETHForTokens(
          amountOutMin, // Minimum amount of tokens
          path, // Path from ETH to Token
          signer.address, // Recipient of the tokens
          Math.floor(Date.now() / 1000) + 60 * 10, // Deadline (10 minutes from now)
          {
            value: ethAmountInWei, // Amount of ETH to spend
            gasLimit: ethers.utils.hexlify(1500000), // Gas limit (adjust if necessary)
          }
        );

        // Wait for the transaction to be mined
        console.log("Transaction sent, waiting for confirmation...");
        const receipt = await tx.wait();
        
        // If transaction status is 1, it's successful
        if (receipt.status === 1) {
          console.log(`Transaction successful! Hash: ${receipt.transactionHash}`);
          success = true;
        } else {
          console.error("Transaction failed with status 0. Retrying...");
        }

      } catch (error) {
        console.error("Error while attempting the transaction. Retrying...");
        console.error(error.message);
        // Retry automatically without asking for confirmation
      }
    }

  } catch (error) {
    console.error("Error buying tokens:", error.message);
    console.error("Additional error details:", error); // Logs the full error object for more information
  } finally {
    rl.close();  // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
