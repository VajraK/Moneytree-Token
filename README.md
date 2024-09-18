# DEPLOY

npx hardhat run scripts/deploy.js --network sepolia

# RENOUNCE OWNERSHIP

npx hardhat run scripts/manageOwnership.js --network sepolia

# MANAGE TAX

npx hardhat run scripts/manageTax.js --network sepolia

# EXAMPLE VERIFICATION

npx hardhat verify --network sepolia [contract-address] 1000000000000000000000000
