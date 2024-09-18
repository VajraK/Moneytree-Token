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

    // Extract relevant config data
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

    // Prompt for the tokenn contract address
    let recipientAddress = await askQuestion("Enter the token contract's address: ");

    // Validate the token contract address
    if (!ethers.utils.isAddress(recipientAddress)) {
      throw new Error("Invalid token contract address.");
    }

    // Prompt for the amount of ETH to send
    let ethAmount = await askQuestion("Enter the amount of ETH you want to send: ");
    if (isNaN(ethAmount) || Number(ethAmount) <= 0) {
      throw new Error("Invalid ETH amount.");
    }

    // Convert ETH amount to BigNumber
    const ethAmountInWei = ethers.utils.parseEther(ethAmount);

    // Log the details
    console.log(`You are about to send ${ethAmount} ETH to ${recipientAddress}`);

    // Prompt for confirmation
    const confirm = await askQuestion("Do you want to proceed with the transaction? (yes/no): ");
    if (confirm.toLowerCase() !== "yes") {
      console.log("Transaction cancelled.");
      rl.close();
      return;
    }

    // Send the transaction
    console.log("Sending transaction...");
    const tx = await signer.sendTransaction({
      to: recipientAddress,
      value: ethAmountInWei,
    });

    // Wait for the transaction to be mined
    console.log(`Transaction sent. Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`Transaction successful! Hash: ${receipt.transactionHash}`);
    } else {
      console.log("Transaction failed.");
    }

  } catch (error) {
    console.error("Error sending ETH:", error.message);
  } finally {
    rl.close();  // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
