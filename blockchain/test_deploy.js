import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("⚡ Connecting to local Hardhat node at http://127.0.0.1:8545...");
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  try {
    const network = await provider.getNetwork();
    console.log(`Connected to network: Chain ID ${network.chainId}`);

    const signer = await provider.getSigner(0);
    const address = await signer.getAddress();
    console.log(`Deployer / DISCOM Account: ${address}`);

    const artifactPath = path.join(
      __dirname,
      "artifacts",
      "contracts",
      "EnergyMarketplace.sol",
      "EnergyMarketplace.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    console.log("Deploying EnergyMarketplace contract...");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
    console.log("✅ EnergyMarketplace Deployed Successfully at:", deployedAddress);

    const deployInfo = {
      contract_address: deployedAddress,
      network: "Hardhat Localhost",
      chain_id: Number(network.chainId),
      deployer: address,
      deployed_at: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(__dirname, "deployment.json"), JSON.stringify(deployInfo, null, 2));
    console.log("Saved deployment metadata to deployment.json");
  } catch (err) {
    console.error("Local node not responding:", err.message);
    process.exit(1);
  }
}

main();
