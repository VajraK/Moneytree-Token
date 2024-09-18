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
    contractName = contractName || "MoneytreeToken";

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

    // Get the signer (the current user)
    const [signer] = await ethers.getSigners();
    const currentUser = await signer.getAddress();

    // Check the current owner of the contract
    const currentOwner = await token.owner();
    console.log("Current owner is:", currentOwner);

    // Check if the current user is the owner
    if (currentUser.toLowerCase() !== currentOwner.toLowerCase()) {
      console.log(`You are not the owner of this contract. Only the owner (${currentOwner}) can renounce ownership.`);
      rl.close();
      return;
    }

    // Confirm if the user wants to renounce ownership
    let answer = await askQuestion(
      "You are the owner. Do you want to renounce ownership? (yes/no): "
    );

    // If the user presses Enter (empty answer), ownership remains unchanged
    if (answer === "") {
      console.log("Ownership remains unchanged.");
    } else if (answer.toLowerCase() === "yes") {
      // Ask for double confirmation
      let confirmAnswer = await askQuestion(
        "Are you sure you want to renounce ownership? This action cannot be reversed! (yes/no): "
      );

      if (confirmAnswer.toLowerCase() === "yes") {
        // Call renounceOwnership function
        console.log("Renouncing ownership...");
        const tx = await token.renounceOwnership();
        console.log("Transaction sent. Waiting for confirmation...");
        await tx.wait(); // Wait for the transaction to be mined
        console.log("Ownership has been renounced.");

        // Check the new owner (should be the zero address)
        const newOwner = await token.owner();
        console.log("New owner is:", newOwner);
      } else {
        console.log("Ownership renouncement canceled.");
      }
    } else {
      console.log("Ownership renouncement canceled.");
    }
  } catch (error) {
    console.error("Error during the process:", error.message);
  } finally {
    rl.close(); // Close the readline interface
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
