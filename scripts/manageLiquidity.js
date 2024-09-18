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

  // Helper function to retry a task multiple times with delay
  const retry = async (fn, retries = 10, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error.message);
        if (i < retries - 1) {
          console.log(`Retrying in ${delay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw new Error(`Failed after ${retries} attempts`);
  };

  try {
    // Load the YAML configuration file
    const config = yaml.load(fs.readFileSync('./config.yaml', 'utf8'));

    // Prompt user for the network (Mainnet or Sepolia)
    let networkChoice = await askQuestion("Choose the network (mainnet or sepolia): ");

    // Determine addresses and configuration based on network choice
    let network;
    if (networkChoice.toLowerCase() === 'mainnet' || !networkChoice) {
      network = 'mainnet';
    } else if (networkChoice.toLowerCase() === 'sepolia') {
      network = 'sepolia';
    } else {
      throw new Error("Invalid network choice! Please choose 'mainnet' or 'sepolia'.");
    }

    // Extract relevant addresses for the chosen network
    const factoryAddress = config.Factory[network];
    const wethAddress = config.WETH[network];
    const swapRouterAddress = config.SwapRouter[network];
    const infuraApiKey = config.infuraApiKey;
    const privateKey = config.privateKey;

    if (!infuraApiKey || !privateKey) {
      throw new Error("Missing Infura API key or private key in the config.yaml file.");
    }

    // Prompt for the Token address
    let tokenAddress = await askQuestion("Enter the deployed Token contract address: ");

    // Validate the token address
    if (!ethers.utils.isAddress(tokenAddress)) {
      throw new Error("Invalid token contract address.");
    }

    // Set up provider and signer
    let provider;
    if (network === 'mainnet') {
      provider = new ethers.providers.InfuraProvider('homestead', infuraApiKey);
    } else {
      provider = new ethers.providers.InfuraProvider('sepolia', infuraApiKey);
    }

    const signer = new ethers.Wallet(privateKey, provider);

    // **Define tokenContract and get token decimals**
    const tokenAbi = [
      "function decimals() view returns (uint8)",
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)"
    ];
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);
    const tokenDecimals = await tokenContract.decimals();

    console.log(`Checking liquidity on the ${network} network`);

    // Uniswap Factory contract ABI (for calling getPair)
    const factoryAbi = [
      "function getPair(address tokenA, address tokenB) external view returns (address pair)"
    ];

    // Get Uniswap Factory contract instance
    const factoryContract = new ethers.Contract(factoryAddress, factoryAbi, provider);

    // Get pair address for the token and WETH
    const pairAddress = await factoryContract.getPair(tokenAddress, wethAddress);
    console.log(`Uniswap Pair Address: ${pairAddress}`);

    if (!pairAddress || pairAddress === ethers.constants.AddressZero) {
      console.log("No pair found for this token and WETH on Uniswap. Liquidity may not have been added yet.");
    } else {
      // Uniswap Pair contract ABI
      const pairAbi = [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)"
      ];

      // Get Uniswap Pair contract instance
      const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);

      // Get token0 and token1 addresses
      const token0Address = await pairContract.token0();
      const token1Address = await pairContract.token1();

      // Get the reserves from the pair contract
      const { reserve0, reserve1 } = await pairContract.getReserves();

      // Determine which reserve corresponds to your token and which to WETH
      let tokenReserve, wethReserve;
      if (token0Address.toLowerCase() === tokenAddress.toLowerCase()) {
        tokenReserve = reserve0;
        wethReserve = reserve1;
      } else if (token1Address.toLowerCase() === tokenAddress.toLowerCase()) {
        tokenReserve = reserve1;
        wethReserve = reserve0;
      } else {
        throw new Error("Token not found in the pair.");
      }

      // Format reserves
      const formattedTokenReserve = ethers.utils.formatUnits(tokenReserve, tokenDecimals);
      const formattedWethReserve = ethers.utils.formatEther(wethReserve);

      console.log(`Token Reserve: ${formattedTokenReserve}`);
      console.log(`WETH Reserve: ${formattedWethReserve}`);

      // Check if liquidity exists
      if (tokenReserve.gt(0) && wethReserve.gt(0)) {
        console.log("Liquidity present in the pool!");

        // Calculate token price in WETH
        const tokenReserveFloat = parseFloat(formattedTokenReserve);
        const wethReserveFloat = parseFloat(formattedWethReserve);

        const tokenPriceInWETH = wethReserveFloat / tokenReserveFloat;
        console.log(`Token Price in WETH: ${tokenPriceInWETH}`);
      } else {
        console.log("No liquidity found in the pool.");
      }
    }

    // Ask user if they want to add liquidity
    const addLiquidity = await askQuestion("Do you want to add liquidity? (yes/no): ");
    if (addLiquidity.toLowerCase() === "yes") {
      console.log(`Adding liquidity on the ${network} network`);

      // Add liquidity to Uniswap using addLiquidityETH
      const uniswapRouter = new ethers.Contract(
        swapRouterAddress,
        [
          "function addLiquidityETH(address token,uint amountTokenDesired,uint amountTokenMin,uint amountETHMin,address to,uint deadline) external payable returns (uint amountToken,uint amountETH,uint liquidity)"
        ],
        signer
      );

      // Prompt for token amount to add as liquidity
      let amountTokenInput = await askQuestion("Enter the amount of tokens you want to add as liquidity: ");
      if (isNaN(amountTokenInput) || Number(amountTokenInput) <= 0) {
        throw new Error("Invalid token amount.");
      }

      // Prompt for ETH amount to pair with the tokens
      let amountETHInput = await askQuestion("Enter the amount of ETH you want to add as liquidity: ");
      if (isNaN(amountETHInput) || Number(amountETHInput) <= 0) {
        throw new Error("Invalid ETH amount.");
      }

      // Prompt for slippage tolerance
      let slippageInput = await askQuestion("Enter the slippage tolerance percentage (e.g., 1 for 1%): ");
      if (isNaN(slippageInput) || Number(slippageInput) < 0 || Number(slippageInput) > 100) {
        throw new Error("Invalid slippage tolerance. Please enter a value between 0 and 100.");
      }
      const slippageTolerance = Number(slippageInput) / 100; // Convert to decimal

      // Parse amounts
      const amountToken = ethers.utils.parseUnits(amountTokenInput.toString(), tokenDecimals);
      const amountETH = ethers.utils.parseEther(amountETHInput.toString());

      // Log values before the transaction
      // console.log(`\n--- Transaction Details ---`);
      // console.log(`Token Address: ${tokenAddress}`);
      // console.log(`Swap Router Address: ${swapRouterAddress}`);
      // console.log(`Amount of Tokens: ${amountTokenInput} (parsed as ${amountToken.toString()})`);
      // console.log(`Amount of ETH: ${amountETHInput} (parsed as ${amountETH.toString()})`);
      // console.log(`Slippage Tolerance: ${slippageInput}%\n`);

      // Check token balance
      const tokenBalance = await tokenContract.balanceOf(signer.address);
      if (tokenBalance.lt(amountToken)) {
        throw new Error("Insufficient token balance.");
      }
      // console.log(`Token Balance of signer: ${ethers.utils.formatUnits(tokenBalance, tokenDecimals)}`);

      console.log(`\nStarting the process of adding liquidity:\n`);

      // Check allowance
      const allowance = await tokenContract.allowance(signer.address, swapRouterAddress);
      // console.log(`Current allowance for Uniswap Router: ${ethers.utils.formatUnits(allowance, tokenDecimals)}\n`);

      if (allowance.lt(amountToken)) {
        const requiredAllowance = amountToken.sub(allowance);
        console.log(`Approving ${ethers.utils.formatUnits(requiredAllowance, tokenDecimals)} tokens for the Uniswap Router...`);
        const approveTx = await tokenContract.approve(swapRouterAddress, amountToken);
        console.log(`Approve Transaction Hash: ${approveTx.hash}`);
        await approveTx.wait();
        console.log("Tokens approved.\n");
      }

      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;  // Deadline is 10 minutes from now

      // Calculate minimum amounts based on slippage tolerance
      const slippageFactor = ethers.BigNumber.from(10000).sub(ethers.BigNumber.from(Math.floor(slippageTolerance * 10000)));
      const amountTokenMin = amountToken.mul(slippageFactor).div(10000);
      const amountETHMin = amountETH.mul(slippageFactor).div(10000);

      // Log minimum amounts
      // console.log(`Minimum amount of Tokens (after slippage): ${ethers.utils.formatUnits(amountTokenMin, tokenDecimals)}`);
      // console.log(`Minimum amount of ETH (after slippage): ${ethers.utils.formatEther(amountETHMin)}\n`);

      // Retry adding liquidity up to 10 times
      await retry(async () => {
        console.log("Sending addLiquidityETH transaction...");
        const tx = await uniswapRouter.addLiquidityETH(
          tokenAddress,
          amountToken,
          amountTokenMin,
          amountETHMin,
          signer.address,
          deadline,
          {
            value: amountETH
            // No gasLimit specified, letting the node estimate
          }
        );
        console.log(`addLiquidityETH Transaction Hash: ${tx.hash}`);
        console.log("Transaction sent. Waiting for confirmation...");
        const receipt = await tx.wait(); // Wait for the transaction to be mined
        console.log("Transaction confirmed in block:", receipt.blockNumber);
        console.log("Liquidity added successfully!");
      });
    } else {
      console.log("Liquidity addition canceled.");
    }

  } catch (error) {
    console.error("Error checking/adding liquidity:", error.message);
  } finally {
    rl.close();  // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
