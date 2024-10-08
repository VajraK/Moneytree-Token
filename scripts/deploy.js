const readline = require("readline");
const hre = require("hardhat"); // Import Hardhat to use its runtime environment

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
    // Prompt for the network (Mainnet or Sepolia)
    let networkChoice = await askQuestion(
      "Choose the network (press Enter for default 'mainnet' or type 'sepolia'): "
    );
    networkChoice = networkChoice.toLowerCase();

    // Set to mainnet if user presses Enter or inputs nothing
    let network;
    if (networkChoice === 'sepolia') {
      network = 'sepolia';
    } else if (networkChoice === 'mainnet' || networkChoice === '') {
      network = 'mainnet';
    } else {
      console.log("Invalid network choice. Defaulting to 'mainnet'.");
      network = 'mainnet';
    }

    // Prompt for other required inputs for deployment
    let contractName = await askQuestion(
      "Enter the contract (factory) name (or press Enter for default 'MoneytreeToken'): "
    );
    contractName = contractName || "MoneytreeToken";

    let initialSupply = await askQuestion(
      "Enter the initial supply (or press Enter for default '1000000'): "
    );
    initialSupply = initialSupply || "1000000";

    // Validate initialSupply is a positive number
    if (isNaN(initialSupply) || Number(initialSupply) <= 0) {
      throw new Error("Invalid initial supply. It must be a positive number.");
    }

    // Get the signer from the Hardhat environment
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    // Check the balance of the deployer's account
    const balance = await deployer.getBalance();
    const balanceInEther = hre.ethers.utils.formatEther(balance);
    console.log(`Current account balance: ${balanceInEther} ETH`);

    // Convert initialSupply to BigNumber with 18 decimals
    const formattedSupply = hre.ethers.utils.parseUnits(initialSupply, 18);

    // Get the contract factory
    const Token = await hre.ethers.getContractFactory(contractName);

    // Estimate gas for deployment
    const deployTransaction = Token.getDeployTransaction(formattedSupply);
    const estimatedGas = await deployer.estimateGas(deployTransaction);

    // Get the current gas price
    const gasPrice = await deployer.getGasPrice();

    // Calculate the total gas fee
    const totalFee = estimatedGas.mul(gasPrice);
    const totalFeeInEther = hre.ethers.utils.formatEther(totalFee); // Convert to Ether for readability

    console.log(`Estimated deployment gas fee: ${totalFeeInEther} ETH`);

    // Check if there are enough funds
    if (balance.lt(totalFee)) {
      console.log(`Insufficient funds: you have ${balanceInEther} ETH but need approximately ${totalFeeInEther} ETH.`);
      throw new Error('Insufficient funds to cover gas fees for deployment.');
    }

    // Confirm with the user
    const answer = await askQuestion(
      `Do you want to proceed with the deployment to ${network}? (yes/no): `
    );

    if (answer.toLowerCase() === "yes") {
      // Deploy the contract with the provided initialSupply
      const token = await Token.deploy(formattedSupply);

      // Wait for the deployment to be confirmed
      await token.deployed();

      console.log(`${contractName} token deployed to:`, token.address);
    } else {
      console.log("Deployment canceled.");
    }

  } catch (error) {
    console.error("Error deploying contract:", error.message); // Improved error logging
  } finally {
    rl.close(); // Close the readline interface
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
