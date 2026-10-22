import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "0x" + "00".repeat(32);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris", // No PUSH0 — required for Tron compatibility
    },
  },
  networks: {
    hardhat: {},
    polygon: {
      url: process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com",
      chainId: 137,
      accounts: [DEPLOYER_KEY],
    },
    base: {
      url: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
      chainId: 8453,
      accounts: [DEPLOYER_KEY],
    },
    // Phase 2 chains
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL ?? "",
      chainId: 1,
      accounts: [DEPLOYER_KEY],
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL ?? "",
      chainId: 42161,
      accounts: [DEPLOYER_KEY],
    },
    bsc: {
      url: process.env.BSC_RPC_URL ?? "",
      chainId: 56,
      accounts: [DEPLOYER_KEY],
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL ?? "",
      chainId: 43114,
      accounts: [DEPLOYER_KEY],
    },
    optimism: {
      url: process.env.OPTIMISM_RPC_URL ?? "",
      chainId: 10,
      accounts: [DEPLOYER_KEY],
    },
  },
};

export default config;
