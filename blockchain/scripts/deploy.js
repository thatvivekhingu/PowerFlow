import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("⚡ Deploying EnergyMarketplace to local EVM blockchain...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with DISCOM Operator account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  const EnergyMarketplace = await hre.ethers.getContractFactory("EnergyMarketplace");
  const contract = await EnergyMarketplace.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ EnergyMarketplace deployed successfully!");
  console.log("   Contract Address:", contractAddress);

  // Save deployed address for backend & frontend
  const deploymentInfo = {
    address: contractAddress,
    deployer: deployer.address,
    network: "localhost",
    chainId: 31337,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("   Saved deployment info to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
