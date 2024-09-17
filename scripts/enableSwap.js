const readline = require("readline");
const hre = require("hardhat");

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
    // Prompt for the contract (factory) name and deployed contract address
    let contractName = await askQuestion(
      "Enter the contract (factory) name (or press Enter for default 'MoneytreeToken'): "
    );
    contractName = contractName || "MoneytreeToken"; // Use default if none is provided

    // Prompt for the deployed contract address
    let contractAddress = await askQuestion("Enter the deployed contract address: ");

    // Validate the contract address
    const { ethers } = hre;
    if (!ethers.utils.isAddress(contractAddress)) {
      throw new Error("Invalid contract address.");
    }

    // Get the contract factory dynamically based on user input (or default)
    const Token = await hre.ethers.getContractFactory(contractName);

    // Attach to the deployed contract at the provided address
    const token = await Token.attach(contractAddress);

    // Retrieve current swap enabled status
    const currentSwapEnabled = await token.swapEnabled();
    console.log(`Current swap enabled status: ${currentSwapEnabled}`);

    // Function to update swap enabled status
    let swapEnabled = await askQuestion(
      `Do you want to enable swaps? (Current: ${currentSwapEnabled}) (yes/no or press Enter to keep it unchanged): `
    );
    if (swapEnabled.toLowerCase() === "yes" || swapEnabled.toLowerCase() === "no") {
      const enableSwap = swapEnabled.toLowerCase() === "yes";
      const confirmChange = await askQuestion(
        `You are about to ${
          enableSwap ? "enable" : "disable"
        } swaps. Proceed? (yes/no): `
      );
      if (confirmChange.toLowerCase() === "yes") {
        try {
          const tx = await token.setSwapEnabled(enableSwap);
          console.log("Waiting for transaction to be mined...");
          await tx.wait();
          console.log(`Swaps are now ${enableSwap ? "enabled" : "disabled"}`);
        } catch (error) {
          console.error("Error changing swap enabled status:", error.message);
        }
      } else {
        console.log("Swap enabled status change aborted.");
      }
    } else if (swapEnabled === "") {
      console.log("Swap enabled status remains unchanged.");
    } else {
      console.log("Invalid input. Swap enabled status remains unchanged.");
    }
  } catch (error) {
    console.error("Error updating swap enabled status:", error.message);
    rl.close(); // Close the readline interface in case of error
  }

  rl.close(); // Close the readline interface
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
