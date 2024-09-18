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

    // Get Uniswap Router contract instance
    const uniswapRouterAbi = [
      "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
      "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
      "function WETH() external pure returns (address)"
    ];

    const uniswapRouter = new ethers.Contract(uniswapRouterAddress, uniswapRouterAbi, signer);

    // Prompt for the Token address
    let tokenAddress = await askQuestion("Enter the Token contract address you want to sell: ");

    // Validate the token address
    if (!ethers.utils.isAddress(tokenAddress)) {
      throw new Error("Invalid token contract address.");
    }

    // Prompt for the amount of tokens you want to sell
    let tokenAmount = await askQuestion("Enter the amount of tokens you want to sell: ");
    if (isNaN(tokenAmount) || Number(tokenAmount) <= 0) {
      throw new Error("Invalid token amount.");
    }

    // Load ERC20 Token ABI (only need 'approve' and 'allowance')
    const erc20Abi = [
      "function approve(address spender, uint256 amount) public returns (bool)",
      "function allowance(address owner, address spender) public view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];

    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);

    // Get token decimals to handle amount conversion
    const tokenDecimals = await tokenContract.decimals();

    // Convert token amount to BigNumber
    const tokenAmountBN = ethers.utils.parseUnits(tokenAmount, tokenDecimals);

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(signer.address, uniswapRouterAddress);

    if (currentAllowance.lt(tokenAmountBN)) {
      console.log("Insufficient allowance. Approving Uniswap Router to spend your tokens...");

      const approveTx = await tokenContract.approve(uniswapRouterAddress, tokenAmountBN);
      console.log(`Approval transaction sent. Hash: ${approveTx.hash}`);
      await approveTx.wait();
      console.log("Approval successful.");
    } else {
      console.log("Sufficient allowance detected.");
    }

    // Set up the token swap path (Token -> WETH -> ETH)
    const wethAddress = await uniswapRouter.WETH();
    const path = [tokenAddress, wethAddress];

    // Set a slippage tolerance (e.g., 1%)
    const slippageTolerance = 50; // 1%

    // Get the current estimated ETH amount from Uniswap
    let amountsOut;
    try {
      amountsOut = await uniswapRouter.getAmountsOut(tokenAmountBN, path);
    } catch (error) {
      console.error("Failed to fetch the ETH amount from Uniswap. Possible reasons could be:");
      console.error("- The token might not have enough liquidity on Uniswap.");
      console.error("- The token address might be invalid or not listed on Uniswap.");
      throw error; // Re-throw the error after logging additional context
    }

    const amountOutMin = amountsOut[1].mul(100 - slippageTolerance).div(100); // Apply slippage tolerance

    // Log the expected ETH amount (before slippage)
    console.log(`Expected ETH to receive (before slippage): ${ethers.utils.formatEther(amountsOut[1])}`);

    // Prompt for confirmation
    const confirm = await askQuestion(
      `Do you want to proceed with the transaction to sell ${tokenAmount} tokens for at least ${ethers.utils.formatEther(amountOutMin)} ETH? (yes/no): `
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
        // Try executing the swap on Uniswap using swapExactTokensForETH
        console.log("Attempting to execute the swap using swapExactTokensForETH...");

        const tx = await uniswapRouter.swapExactTokensForETH(
          tokenAmountBN, // Amount of tokens to sell
          amountOutMin, // Minimum amount of ETH to receive
          path, // Path from Token to ETH
          signer.address, // Recipient of the ETH
          Math.floor(Date.now() / 1000) + 60 * 10, // Deadline (10 minutes from now)
          {
            gasLimit: ethers.utils.hexlify(200000), // Gas limit (adjust if necessary)
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
        console.error("swapExactTokensForETH failed. Attempting swapExactTokensForETHSupportingFeeOnTransferTokens...");

        // Attempting the alternative function for fee-on-transfer tokens
        try {
          const tx = await uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmountBN, // Amount of tokens to sell
            amountOutMin, // Minimum amount of ETH to receive
            path, // Path from Token to ETH
            signer.address, // Recipient of the ETH
            Math.floor(Date.now() / 1000) + 60 * 10, // Deadline (10 minutes from now)
            {
              gasLimit: ethers.utils.hexlify(200000), // Gas limit (adjust if necessary)
            }
          );

          // Wait for the transaction to be mined
          console.log("Transaction sent using swapExactTokensForETHSupportingFeeOnTransferTokens, waiting for confirmation...");
          const receipt = await tx.wait();

          // If transaction status is 1, it's successful
          if (receipt.status === 1) {
            console.log(`Transaction successful with fee-on-transfer! Hash: ${receipt.transactionHash}`);
            success = true;
          } else {
            console.error("Transaction failed with status 0. Retrying...");
          }

        } catch (error) {
          console.error("Both swap methods failed. Retrying...");
          console.error(error.message);
          await new Promise(res => setTimeout(res, 5000)); // Wait 5 seconds before retrying
        }
      }
    }

  } catch (error) {
    console.error("Error selling tokens:", error.message);
    console.error("Additional error details:", error); // Logs the full error object for more information
  } finally {
    rl.close();  // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
