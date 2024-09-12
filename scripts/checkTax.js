const readline = require("readline");

async function main() {
  // Set up readline to get input from the console
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt for the contract factory name and deployed contract address
  rl.question("Enter the contract (factory) name (or press Enter for default 'MoneytreeToken'): ", async (contractName) => {
    // Use 'MoneytreeToken' as default if no contract name is provided
    if (!contractName) {
      contractName = "MoneytreeToken";
    }

    rl.question("Enter the deployed contract address: ", async (contractAddress) => {
      try {
        // Get the contract factory dynamically based on user input (or default)
        const Token = await ethers.getContractFactory(contractName);

        // Attach to the deployed contract at the provided address
        const token = await Token.attach(contractAddress);

        // Retrieve the current tax rate
        const currentTaxRate = await token.taxRate();
        
        // Retrieve the tax collector address
        const taxCollector = await token.taxCollector();

        // Convert tax rate to percentage (basis points to percentage)
        const taxPercentage = currentTaxRate / 100;

        console.log("Current tax rate is:", taxPercentage, "%");
        console.log("Tax is collected by:", taxCollector);
      } catch (error) {
        console.error("Error checking tax rate or tax collector:", error);
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
