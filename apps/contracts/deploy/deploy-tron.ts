/**
 * Tron deploy script — reads Hardhat-compiled artifact and deploys via TronWeb.
 *
 * Usage:
 *   # Compile with Hardhat first (evmVersion: "paris" produces Tron-compatible bytecode)
 *   npx hardhat compile
 *   # Then deploy to Tron
 *   npx ts-node deploy/deploy-tron.ts
 *
 * Required env vars:
 *   TRON_PRIVATE_KEY  — deployer private key (hex, no 0x prefix)
 *   TRON_API_URL      — e.g. https://api.trongrid.io (mainnet) or https://api.shasta.trongrid.io (testnet)
 *   TRON_API_KEY      — TronGrid API key
 */

import * as fs from "fs";
import * as path from "path";
import { CHAIN_TOKENS } from "./chain-tokens";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TronWeb = require("tronweb");

async function main() {
  const privateKey = process.env.TRON_PRIVATE_KEY;
  if (!privateKey) throw new Error("TRON_PRIVATE_KEY not set");

  const apiUrl = process.env.TRON_API_URL ?? "https://api.trongrid.io";
  const apiKey = process.env.TRON_API_KEY ?? "";

  const tronWeb = new TronWeb({
    fullHost: apiUrl,
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : {},
    privateKey,
  });

  // Read Hardhat-compiled artifact
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "PaymentReceiver.sol",
    "PaymentReceiver.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Run 'npx hardhat compile' first.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const ownerAddress = tronWeb.address.fromPrivateKey(privateKey);

  console.log(`Deploying PaymentReceiver on Tron with owner ${ownerAddress}`);

  // Deploy contract
  const tx = await tronWeb.transactionBuilder.createSmartContract(
    {
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      feeLimit: 1_000_000_000, // 1000 TRX
      callValue: 0,
      parameters: [ownerAddress],
    },
    ownerAddress
  );

  const signed = await tronWeb.trx.sign(tx, privateKey);
  const receipt = await tronWeb.trx.sendRawTransaction(signed);

  if (!receipt.result) {
    throw new Error(`Deploy failed: ${JSON.stringify(receipt)}`);
  }

  const contractAddress = tronWeb.address.fromHex(
    receipt.transaction?.contract_address ?? tx.contract_address
  );
  console.log(`PaymentReceiver deployed to: ${contractAddress}`);

  // Wait for confirmation
  console.log("Waiting for confirmation...");
  await new Promise((r) => setTimeout(r, 5000));

  // Register tokens
  const contract = await tronWeb.contract(artifact.abi, contractAddress);
  const tokens = CHAIN_TOKENS.tron;

  if (tokens.USDT) {
    await contract.registerToken(tokens.USDT).send({ feeLimit: 100_000_000 });
    console.log(`Registered USDT: ${tokens.USDT}`);
  }

  if (tokens.USDC) {
    await contract.registerToken(tokens.USDC).send({ feeLimit: 100_000_000 });
    console.log(`Registered USDC: ${tokens.USDC}`);
  }

  console.log("\nDone. Set the following env var in the API:");
  console.log(`  TRON_PAYMENT_RECEIVER=${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
