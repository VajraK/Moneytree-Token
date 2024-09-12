const readline = require("readline");

async function main() {
  // Set up readline to get input from the console
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt for the contract (factory) name and deployed contract address
  rl.question("Enter the contract (factory) name (or press Enter for default 'MoneytreeToken'): ", async (contractName) => {
    // Use 'MoneytreeToken' as the default if no contract name is provided
    if (!contractName) {
      contractName = "MoneytreeToken";
    }

    // Prompt for the deployed contract address
    rl.question("Enter the deployed contract address: ", async (contractAddress) => {
      try {
        // Get the contract factory dynamically based on user input (or default)
        const Token = await ethers.getContractFactory(contractName);

        // Attach to the deployed contract at the provided address
        const token = await Token.attach(contractAddress);

        // Retrieve current tax rate and tax collector
        const currentTaxRate = await token.taxRate();
        const currentTaxCollector = await token.taxCollector();

        console.log(`Current tax rate is: ${currentTaxRate / 100} %`);
        console.log(`Current tax collector is: ${currentTaxCollector}`);

        // Prompt for the new tax rate
        rl.question(`Enter the new tax rate (basis points, e.g., 100 for 1%) or press Enter to keep it unchanged: `, async (newTaxRate) => {
          if (newTaxRate) {
            try {
              await token.setTaxRate(newTaxRate);
              console.log(`Tax rate changed to: ${newTaxRate / 100} %`);
            } catch (error) {
              console.error("Error changing tax rate:", error);
            }
          } else {
            console.log("Tax rate remains unchanged.");
          }

          // Prompt for the new tax collector
          rl.question("Enter the new tax collector address or press Enter to keep it unchanged: ", async (newTaxCollector) => {
            if (newTaxCollector) {
              try {
                await token.setTaxCollector(newTaxCollector);
                console.log(`Tax collector changed to: ${newTaxCollector}`);
              } catch (error) {
                console.error("Error changing tax collector:", error);
              }
            } else {
              console.log("Tax collector remains unchanged.");
            }

            rl.close(); // Close the readline interface
          });
        });
      } catch (error) {
        console.error("Error updating contract settings:", error);
        rl.close(); // Close the readline interface in case of error
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
