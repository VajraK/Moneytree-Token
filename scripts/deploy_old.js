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

    // Prompt for the initial supply
    rl.question("Enter the initial supply (or press Enter for default '1000000'): ", async (initialSupply) => {
      // Default initial supply to 1000000 if no input is given
      if (!initialSupply) {
        initialSupply = "1000000";
      }

      try {
        const [deployer] = await ethers.getSigners();

        console.log("Deploying contracts with the account:", deployer.address);

        // Convert initialSupply to a BigNumber with 18 decimals
        const formattedSupply = ethers.utils.parseUnits(initialSupply, 18); // Adjust for 18 decimal places

        // Get the contract factory dynamically based on user input (or default)
        const Token = await ethers.getContractFactory(contractName);

        // Estimate gas for deployment
        const estimatedGas = await Token.signer.estimateGas(Token.getDeployTransaction(formattedSupply));
        
        // Get the current gas price
        const gasPrice = await Token.signer.getGasPrice();

        // Calculate the total gas fee
        const totalFee = estimatedGas.mul(gasPrice);
        const totalFeeInEther = ethers.utils.formatEther(totalFee); // Convert to Ether for readability

        console.log(`Estimated deployment gas fee: ${totalFeeInEther} ETH`);

        // Confirm with the user
        rl.question("Do you want to proceed with the deployment? (yes/no): ", async (answer) => {
          if (answer.toLowerCase() === "yes") {
            // Deploy the contract with the provided initialSupply
            const token = await Token.deploy(formattedSupply);

            // Wait for the deployment to be confirmed
            await token.deployed();

            console.log(`${contractName} token deployed to:`, token.address);
          } else {
            console.log("Deployment canceled.");
          }

          rl.close(); // Close the readline interface
        });
      } catch (error) {
        console.error("Error deploying contract:", error);
        rl.close(); // Close the readline interface in case of error
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});