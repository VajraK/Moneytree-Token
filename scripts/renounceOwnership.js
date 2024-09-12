const readline = require("readline");

async function main() {
  // Set up readline to get input from the console
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt for the contract (factory) name
  rl.question("Enter the contract (factory) name (or press Enter for default 'MoneytreeToken'): ", async (contractName) => {
    // Use 'MoneytreeToken' as the default if no contract name is provided
    if (!contractName) {
      contractName = "MoneytreeToken";
    }

    // Prompt for the contract address
    rl.question("Enter the deployed contract address: ", async (contractAddress) => {
      try {
        // Get the contract factory dynamically based on user input (or default)
        const Token = await ethers.getContractFactory(contractName);

        // Attach to the deployed contract at the provided address
        const token = await Token.attach(contractAddress);

        // Check the current owner
        const currentOwner = await token.owner();
        console.log("Current owner is:", currentOwner);

        // Confirm renouncement
        rl.question("Do you want to renounce ownership? (yes/no): ", async (answer) => {
          if (answer.toLowerCase() === "yes") {
            // Call renounceOwnership function
            const tx = await token.renounceOwnership();
            await tx.wait(); // Wait for the transaction to be mined
            console.log("Ownership has been renounced.");

            // Check the new owner (should be the zero address)
            const newOwner = await token.owner();
            console.log("New owner is:", newOwner);
          } else {
            console.log("Ownership renouncement canceled.");
          }

          rl.close(); // Close the readline interface
        });
      } catch (error) {
        console.error("Error during the renounce process:", error);
        rl.close(); // Close the readline interface in case of error
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
