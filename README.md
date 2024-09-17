# DEPLOY

npx hardhat run scripts/deploy.js --network sepolia

# CHECK OWNERSHIP

npx hardhat run scripts/checkOwnership.js --network sepolia

# RENOUNCE OWNERSHIP

npx hardhat run scripts/renounceOwnership.js --network sepolia

# MANAGE TAX

npx hardhat run scripts/manageTax.js --network sepolia

# EXAMPLE VERIFICATION

npx hardhat verify --network sepolia [contract-address] 1000000000000000000000000 [uniswap-router]
