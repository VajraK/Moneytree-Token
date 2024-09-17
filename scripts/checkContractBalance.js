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

    // Create signer
    const signer = new ethers.Wallet(privateKey, provider);

    console.log(`Checking tax tokens collected on the ${network} network`);

    // ABI for the MoneytreeToken contract to query the `tokensForTax` variable
    const tokenAbi = [
      "function tokensForTax() external view returns (uint256)",
      "function decimals() external view returns (uint8)"
    ];

    // Get MoneytreeToken contract instance
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);

    // Get the number of tax tokens collected
    const tokensForTax = await tokenContract.tokensForTax();

    // Get token decimals to format the tax amount
    const tokenDecimals = await tokenContract.decimals();
    const formattedTaxTokens = ethers.utils.formatUnits(tokensForTax, tokenDecimals);

    console.log(`Tax tokens collected in the contract: ${formattedTaxTokens}`);

  } catch (error) {
    console.error("Error checking tax tokens:", error.message);
  } finally {
    rl.close();  // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
