/**
 * Centralised config for supported chains, their RPC URLs and token contract addresses.
 *
 * Phase 1: Polygon, Base, Tron (low fees, high USDT/USDC liquidity).
 * Phase 2: Ethereum, Arbitrum, BSC, Avalanche, Optimism, Solana — mostly config.
 */

export interface ChainConfig {
  family: 'evm' | 'tron' | 'solana';
  chainId?: number;
  name: string;
  /** Environment variable key for the RPC URL override; falls back to `rpc`. */
  rpcEnvKey?: string;
  rpc?: string;
  tokens: {
    USDT?: string;
    USDC?: string;
  };
  /** Whether this chain is enabled in Phase 1. */
  phase1: boolean;
}

export const CHAINS: Record<string, ChainConfig> = {
  // ── Phase 1 EVM ──
  polygon: {
    family: 'evm',
    chainId: 137,
    name: 'Polygon',
    rpcEnvKey: 'POLYGON_RPC_URL',
    rpc: 'https://polygon-rpc.com',
    tokens: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    },
    phase1: true,
  },
  base: {
    family: 'evm',
    chainId: 8453,
    name: 'Base',
    rpcEnvKey: 'BASE_RPC_URL',
    rpc: 'https://mainnet.base.org',
    tokens: {
      USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
    phase1: true,
  },

  // ── Phase 1 Tron ──
  tron: {
    family: 'tron',
    name: 'Tron',
    rpcEnvKey: 'TRON_RPC_URL',
    tokens: {
      USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
    },
    phase1: true,
  },

  // ── Phase 2 EVM (address already works, just need monitoring) ──
  ethereum: {
    family: 'evm',
    chainId: 1,
    name: 'Ethereum',
    rpcEnvKey: 'ETHEREUM_RPC_URL',
    tokens: {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    phase1: false,
  },
  arbitrum: {
    family: 'evm',
    chainId: 42161,
    name: 'Arbitrum',
    rpcEnvKey: 'ARBITRUM_RPC_URL',
    tokens: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    },
    phase1: false,
  },
  bsc: {
    family: 'evm',
    chainId: 56,
    name: 'BNB Chain',
    rpcEnvKey: 'BSC_RPC_URL',
    tokens: {
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    },
    phase1: false,
  },
  avalanche: {
    family: 'evm',
    chainId: 43114,
    name: 'Avalanche',
    rpcEnvKey: 'AVALANCHE_RPC_URL',
    tokens: {
      USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    },
    phase1: false,
  },
  optimism: {
    family: 'evm',
    chainId: 10,
    name: 'Optimism',
    rpcEnvKey: 'OPTIMISM_RPC_URL',
    tokens: {
      USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    },
    phase1: false,
  },

  // ── Phase 2 Solana ──
  solana: {
    family: 'solana',
    name: 'Solana',
    rpcEnvKey: 'SOLANA_RPC_URL',
    tokens: {
      USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    phase1: false,
  },
};

/** All chains belonging to a given family. */
export function chainsForFamily(family: string): string[] {
  return Object.entries(CHAINS)
    .filter(([, c]) => c.family === family)
    .map(([id]) => id);
}

/** Phase 1 chains only. */
export function phase1Chains(): string[] {
  return Object.entries(CHAINS)
    .filter(([, c]) => c.phase1)
    .map(([id]) => id);
}

/** Enabled chain families in Phase 1. */
export function phase1Families(): string[] {
  return [...new Set(phase1Chains().map((id) => CHAINS[id].family))];
}

/** Which tokens a chain supports. */
export function supportedTokens(chainId: string): ('USDT' | 'USDC')[] {
  const chain = CHAINS[chainId];
  if (!chain) return [];
  const result: ('USDT' | 'USDC')[] = [];
  if (chain.tokens.USDT) result.push('USDT');
  if (chain.tokens.USDC) result.push('USDC');
  return result;
}
