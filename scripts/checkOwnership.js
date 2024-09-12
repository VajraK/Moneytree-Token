const readline = require("readline");

async function main() {
  // Set up readline to get input from the console
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt for the contract (factory) name
  rl.question("Enter the contract (factory) name (or press Enter for default 'MoneytreeToken'): ", async (contractName) => {
    // Use 'RenounceMoneytreeToken' as the default if no contract name is provided
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
      } catch (error) {
        console.error("Error checking ownership:", error);
      } finally {
        rl.close(); // Close the readline interface
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
