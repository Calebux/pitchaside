import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { CryptoClient, DerivedAddress, IncomingCryptoTransfer } from '../crypto-client';
import { CHAINS } from './chain-registry';

/** Minimal ERC-20 ABI for balance and transfer. */
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

export class EvmClient implements CryptoClient {
  readonly chainFamily = 'evm' as const;
  private readonly logger = new Logger(EvmClient.name);
  private readonly hdNode: ethers.HDNodeWallet;

  constructor(
    private readonly masterSeed: string,
    private readonly webhookSecret: string,
    private readonly rpcOverrides: Record<string, string>,
  ) {
    // Derive the EVM root from the master seed: m/44'/60'/0'/0
    const seed = Buffer.from(masterSeed, 'hex');
    const root = ethers.HDNodeWallet.fromSeed(seed);
    this.hdNode = root.derivePath("m/44'/60'/0'/0");
  }

  deriveAddress(index: number): DerivedAddress {
    const child = this.hdNode.deriveChild(index);
    return { address: child.address };
  }

  async getTokenBalance(chain: string, address: string, token: 'USDT' | 'USDC'): Promise<number> {
    const provider = this.providerFor(chain);
    const tokenAddress = CHAINS[chain]?.tokens[token];
    if (!tokenAddress) return 0;

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [balance, decimals] = await Promise.all([
      contract.balanceOf(address) as Promise<bigint>,
      contract.decimals() as Promise<bigint>,
    ]);
    return Number(ethers.formatUnits(balance, decimals));
  }

  async sendTokens(
    chain: string,
    fromIndex: number,
    to: string,
    token: string,
    amount: number,
  ): Promise<{ txHash: string }> {
    const provider = this.providerFor(chain);
    const child = this.hdNode.deriveChild(fromIndex).connect(provider);
    const tokenAddress = CHAINS[chain]?.tokens[token as 'USDT' | 'USDC'];
    if (!tokenAddress) throw new Error(`Token ${token} not supported on ${chain}`);

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, child);
    const decimals = await contract.decimals() as bigint;
    const wei = ethers.parseUnits(amount.toFixed(6), decimals);
    const tx = await contract.transfer(to, wei);
    await tx.wait();
    return { txHash: tx.hash };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Parse an Alchemy Notify address-activity webhook payload.
   * Returns null if it isn't a relevant USDT/USDC transfer.
   */
  parseWebhook(chain: string, payload: unknown): IncomingCryptoTransfer | null {
    const data = payload as {
      event?: {
        activity?: {
          hash?: string;
          fromAddress?: string;
          toAddress?: string;
          value?: number;
          asset?: string;
          rawContract?: { address?: string; rawValue?: string; decimals?: number };
          blockNum?: string;
          category?: string;
        }[];
      };
    };

    const activities = data?.event?.activity;
    if (!Array.isArray(activities) || activities.length === 0) return null;

    const chainConfig = CHAINS[chain];
    if (!chainConfig) return null;

    // Find the first relevant USDT/USDC transfer
    for (const activity of activities) {
      if (activity.category !== 'token' && activity.category !== 'erc20') continue;

      const contractAddr = activity.rawContract?.address?.toLowerCase();
      if (!contractAddr) continue;

      let token: 'USDT' | 'USDC' | null = null;
      if (chainConfig.tokens.USDT?.toLowerCase() === contractAddr) token = 'USDT';
      else if (chainConfig.tokens.USDC?.toLowerCase() === contractAddr) token = 'USDC';
      if (!token) continue;

      const decimals = activity.rawContract?.decimals ?? 6;
      const rawValue = activity.rawContract?.rawValue;
      const amount = rawValue
        ? Number(ethers.formatUnits(BigInt(rawValue), decimals))
        : activity.value ?? 0;

      return {
        txHash: activity.hash ?? '',
        chain,
        token,
        fromAddress: activity.fromAddress ?? null,
        toAddress: activity.toAddress ?? '',
        amount,
        blockNumber: activity.blockNum ? parseInt(activity.blockNum, 16) : null,
        receivedAt: new Date(),
        raw: payload,
      };
    }

    return null;
  }

  private providerFor(chain: string): ethers.JsonRpcProvider {
    const config = CHAINS[chain];
    if (!config || config.family !== 'evm') throw new Error(`Unknown EVM chain: ${chain}`);
    const rpc = (config.rpcEnvKey && this.rpcOverrides[config.rpcEnvKey]) || config.rpc;
    if (!rpc) throw new Error(`No RPC URL for chain: ${chain}`);
    return new ethers.JsonRpcProvider(rpc);
  }
}
