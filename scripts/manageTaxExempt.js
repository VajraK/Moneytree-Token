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

    // Function to manage tax exemptions
    async function manageTaxExempt() {
      const action = await askQuestion(
        "Would you like to 'add' or 'remove' an address from the tax-exempt list? (add/remove): "
      );
      if (action.toLowerCase() !== "add" && action.toLowerCase() !== "remove") {
        console.log("Invalid action. Please choose 'add' or 'remove'.");
        return;
      }

      let addressToUpdate = await askQuestion(
        "Enter the address to update in the tax-exempt list: "
      );
      if (!ethers.utils.isAddress(addressToUpdate)) {
        console.error("Invalid address.");
        return;
      }

      const isAdding = action.toLowerCase() === "add";
      const confirmAction = await askQuestion(
        `You are about to ${isAdding ? "add" : "remove"} ${addressToUpdate} ${
          isAdding ? "to" : "from"
        } the tax-exempt list. Proceed? (yes/no): `
      );

      if (confirmAction.toLowerCase() === "yes") {
        try {
          const tx = await token.setTaxExemption(addressToUpdate, isAdding);
          console.log("Waiting for transaction to be mined...");
          await tx.wait();
          console.log(
            `${addressToUpdate} was successfully ${
              isAdding ? "added to" : "removed from"
            } the tax-exempt list.`
          );
        } catch (error) {
          console.error(
            `Error ${isAdding ? "adding" : "removing"} address:`,
            error.message
          );
        }
      } else {
        console.log(`${isAdding ? "Adding" : "Removing"} address aborted.`);
      }
    }

    // Manage tax exemptions
    await manageTaxExempt();

    console.log("\n--- Update Complete ---");
    rl.close(); // Close the readline interface
  } catch (error) {
    console.error("Error managing tax exemptions:", error.message);
    rl.close(); // Close the readline interface in case of error
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
