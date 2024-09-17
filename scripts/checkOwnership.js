const readline = require("readline");
const hre = require("hardhat"); // Import Hardhat runtime environment
const ethers = hre.ethers;

async function main() {
  // Set up readline to get input from the console
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Helper function to prompt user input
  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    // Prompt for the contract (factory) name
    let contractName = await askQuestion(
      "Enter the contract (factory) name (or press Enter for default 'MoneytreeToken'): "
    );
    // Use 'MoneytreeToken' as the default if no contract name is provided
    if (!contractName) {
      contractName = "MoneytreeToken";
    }

    // Prompt for the contract address
    let contractAddress = await askQuestion("Enter the deployed contract address: ");

    // Validate the contract address
    if (!ethers.utils.isAddress(contractAddress)) {
      throw new Error("Invalid contract address.");
    }

    // Get the contract factory dynamically based on user input (or default)
    const Token = await ethers.getContractFactory(contractName);

    // Attach to the deployed contract at the provided address
    const token = await Token.attach(contractAddress);

    // Check the current owner
    const currentOwner = await token.owner();
    console.log("Current owner is:", currentOwner);
  } catch (error) {
    console.error("Error checking ownership:", error.message);
  } finally {
    rl.close(); // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
