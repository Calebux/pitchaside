/**
 * Hardhat deploy script for EVM chains.
 *
 * Usage:
 *   npx hardhat run deploy/deploy-evm.ts --network polygon
 *   npx hardhat run deploy/deploy-evm.ts --network base
 */

import { ethers, network } from "hardhat";
import { CHAIN_TOKENS } from "./chain-tokens";

async function main() {
  const chainName = network.name;
  const tokens = CHAIN_TOKENS[chainName];
  if (!tokens) {
    throw new Error(`No token config for chain: ${chainName}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying PaymentReceiver on ${chainName} with owner ${deployer.address}`);

  const PaymentReceiver = await ethers.getContractFactory("PaymentReceiver");
  const receiver = await PaymentReceiver.deploy(deployer.address);
  await receiver.waitForDeployment();

  const address = await receiver.getAddress();
  console.log(`PaymentReceiver deployed to: ${address}`);

  // Register supported tokens
  if (tokens.USDT) {
    const tx = await receiver.registerToken(tokens.USDT);
    await tx.wait();
    console.log(`Registered USDT: ${tokens.USDT}`);
  }

  if (tokens.USDC) {
    const tx = await receiver.registerToken(tokens.USDC);
    await tx.wait();
    console.log(`Registered USDC: ${tokens.USDC}`);
  }

  console.log("\nDone. Set the following env var in the API:");
  console.log(`  ${chainName.toUpperCase()}_PAYMENT_RECEIVER=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
