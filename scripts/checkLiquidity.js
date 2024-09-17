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

    // Set up provider
    let provider;
    if (network === 'mainnet') {
      provider = new ethers.providers.InfuraProvider('homestead', infuraApiKey);
    } else {
      provider = new ethers.providers.InfuraProvider('sepolia', infuraApiKey);
    }

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
      return;
    }

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

    // Get token decimals
    const tokenAbi = ["function decimals() view returns (uint8)"];
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
    const tokenDecimals = await tokenContract.decimals();

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

  } catch (error) {
    console.error("Error checking liquidity:", error.message);
  } finally {
    rl.close();  // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
