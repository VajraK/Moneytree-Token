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

    // Retrieve current settings
    const currentTaxRate = await token.taxRate();
    const currentTaxCollector = await token.taxCollector();
    const currentSwapTokensAtAmount = await token.swapTokensAtAmount();
    const currentSlippageTolerance = await token.slippageTolerance();

    console.log("\n--- Current Contract Settings ---");
    console.log(`Tax rate: ${currentTaxRate / 100} %`);
    console.log(`Tax collector: ${currentTaxCollector}`);
    console.log(
      `Swap tokens threshold: ${ethers.utils.formatUnits(
        currentSwapTokensAtAmount,
        18
      )} MT`
    );
    console.log(`Slippage tolerance: ${currentSlippageTolerance}%`);
    console.log("---------------------------------\n");

    // Function to update tax rate
    async function updateTaxRate() {
      let newTaxRate = await askQuestion(
        `Enter the new tax rate (basis points, e.g., 100 for 1%) or press Enter to keep it unchanged: `
      );
      if (newTaxRate) {
        if (isNaN(newTaxRate) || newTaxRate < 0 || newTaxRate > 2000) {
          console.error(
            "Invalid tax rate. It must be a number between 0 and 2000 (basis points)."
          );
        } else {
          const confirmChange = await askQuestion(
            `You are about to change the tax rate to ${newTaxRate / 100}%. Proceed? (yes/no): `
          );
          if (confirmChange.toLowerCase() === "yes") {
            try {
              const tx = await token.setTaxRate(newTaxRate);
              console.log("Waiting for transaction to be mined...");
              await tx.wait();
              console.log(`Tax rate changed to: ${newTaxRate / 100} %`);
            } catch (error) {
              console.error("Error changing tax rate:", error.message);
            }
          } else {
            console.log("Tax rate change aborted.");
          }
        }
      } else {
        console.log("Tax rate remains unchanged.");
      }
    }

    // Function to update tax collector
    async function updateTaxCollector() {
      let newTaxCollector = await askQuestion(
        "Enter the new tax collector address or press Enter to keep it unchanged: "
      );
      if (newTaxCollector) {
        if (!ethers.utils.isAddress(newTaxCollector)) {
          console.error("Invalid tax collector address.");
        } else {
          const confirmChange = await askQuestion(
            `You are about to change the tax collector to ${newTaxCollector}. Proceed? (yes/no): `
          );
          if (confirmChange.toLowerCase() === "yes") {
            try {
              const tx = await token.setTaxCollector(newTaxCollector);
              console.log("Waiting for transaction to be mined...");
              await tx.wait();
              console.log(`Tax collector changed to: ${newTaxCollector}`);
            } catch (error) {
              console.error("Error changing tax collector:", error.message);
            }
          } else {
            console.log("Tax collector change aborted.");
          }
        }
      } else {
        console.log("Tax collector remains unchanged.");
      }
    }

    // Function to update swap tokens threshold
    async function updateSwapTokensThreshold() {
      let newSwapTokensAtAmount = await askQuestion(
        `Enter the new swap tokens threshold (MT) or press Enter to keep it unchanged: `
      );
      if (newSwapTokensAtAmount) {
        if (isNaN(newSwapTokensAtAmount) || Number(newSwapTokensAtAmount) <= 0) {
          console.error(
            "Invalid swap tokens threshold. It must be a positive number."
          );
        } else {
          const confirmChange = await askQuestion(
            `You are about to change the swap tokens threshold to ${newSwapTokensAtAmount} MT. Proceed? (yes/no): `
          );
          if (confirmChange.toLowerCase() === "yes") {
            try {
              let swapTokensAtAmountWei = ethers.utils.parseUnits(
                newSwapTokensAtAmount,
                18
              ); // Convert to 18 decimals
              const tx = await token.setSwapTokensAtAmount(swapTokensAtAmountWei);
              console.log("Waiting for transaction to be mined...");
              await tx.wait();
              console.log(
                `Swap tokens threshold changed to: ${newSwapTokensAtAmount} MT`
              );
            } catch (error) {
              console.error("Error changing swap tokens threshold:", error.message);
            }
          } else {
            console.log("Swap tokens threshold change aborted.");
          }
        }
      } else {
        console.log("Swap tokens threshold remains unchanged.");
      }
    }

    // Function to update slippage tolerance
    async function updateSlippageTolerance() {
      let newSlippageTolerance = await askQuestion(
        `Enter the new slippage tolerance (e.g., 1 for 1%) or press Enter to keep it unchanged: `
      );
      if (newSlippageTolerance) {
        if (isNaN(newSlippageTolerance) || newSlippageTolerance < 0 || newSlippageTolerance > 100) {
          console.error("Invalid slippage tolerance. It must be a number between 0 and 100%.");
        } else {
          const confirmChange = await askQuestion(
            `You are about to change the slippage tolerance to ${newSlippageTolerance}%. Proceed? (yes/no): `
          );
          if (confirmChange.toLowerCase() === "yes") {
            try {
              const tx = await token.setSlippageTolerance(newSlippageTolerance);
              console.log("Waiting for transaction to be mined...");
              await tx.wait();
              console.log(`Slippage tolerance changed to: ${newSlippageTolerance}%`);
            } catch (error) {
              console.error("Error changing slippage tolerance:", error.message);
            }
          } else {
            console.log("Slippage tolerance change aborted.");
          }
        }
      } else {
        console.log("Slippage tolerance remains unchanged.");
      }
    }

    // Execute the update functions
    await updateTaxRate();
    console.log("---------------------------------\n");
    await updateTaxCollector();
    console.log("---------------------------------\n");
    await updateSwapTokensThreshold();
    console.log("---------------------------------\n");
    await updateSlippageTolerance();

    console.log("\n--- Update Complete ---");
    rl.close(); // Close the readline interface
  } catch (error) {
    console.error("Error updating contract settings:", error.message);
    rl.close(); // Close the readline interface in case of error
  }
}

main().catch((error) => {
  console.error("Script failed with error:", error.message);
  process.exitCode = 1;
});
