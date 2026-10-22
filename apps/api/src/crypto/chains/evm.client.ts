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

/** PaymentReceived event signature for log detection. */
const PAYMENT_RECEIVED_TOPIC = ethers.id(
  'PaymentReceived(address,address,address,uint256,uint256)',
);

/** ABI fragment for decoding PaymentReceived event data. */
const PAYMENT_RECEIVED_ABI = [
  'event PaymentReceived(address indexed admin, address indexed payer, address indexed token, uint256 amount, uint256 timestamp)',
];
const PAYMENT_RECEIVED_IFACE = new ethers.Interface(PAYMENT_RECEIVED_ABI);

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
   * Parse an Alchemy webhook payload.
   *
   * Handles two payload shapes:
   * 1. Custom webhook with `PaymentReceived` event logs from the PaymentReceiver contract.
   * 2. Address-activity webhook for direct USDT/USDC transfers.
   */
  parseWebhook(chain: string, payload: unknown): IncomingCryptoTransfer | null {
    // Try contract event parsing first
    const contractTransfer = this.parseContractEvent(chain, payload);
    if (contractTransfer) return contractTransfer;

    // Fall through to address-activity parsing
    return this.parseAddressActivity(chain, payload);
  }

  /**
   * Parse a PaymentReceived event from an Alchemy custom webhook payload.
   * The payload contains event logs; we look for logs matching the PaymentReceived topic.
   */
  private parseContractEvent(chain: string, payload: unknown): IncomingCryptoTransfer | null {
    const data = payload as {
      event?: {
        data?: {
          block?: {
            logs?: {
              topics?: string[];
              data?: string;
              transaction?: { hash?: string; block?: { number?: number } };
            }[];
          };
        };
      };
    };

    const logs = data?.event?.data?.block?.logs;
    if (!Array.isArray(logs) || logs.length === 0) return null;

    const chainConfig = CHAINS[chain];
    if (!chainConfig) return null;

    for (const log of logs) {
      if (!log.topics || log.topics[0] !== PAYMENT_RECEIVED_TOPIC) continue;

      try {
        const parsed = PAYMENT_RECEIVED_IFACE.parseLog({
          topics: log.topics,
          data: log.data ?? '0x',
        });
        if (!parsed) continue;

        const adminAddr: string = parsed.args[0];
        const payerAddr: string = parsed.args[1];
        const tokenAddr: string = parsed.args[2];
        const amount: bigint = parsed.args[3];

        // Identify which token
        let token: 'USDT' | 'USDC' | null = null;
        if (chainConfig.tokens.USDT?.toLowerCase() === tokenAddr.toLowerCase()) token = 'USDT';
        else if (chainConfig.tokens.USDC?.toLowerCase() === tokenAddr.toLowerCase()) token = 'USDC';
        if (!token) continue;

        // Stablecoins are 6 decimals
        const amountNum = Number(ethers.formatUnits(amount, 6));

        return {
          txHash: log.transaction?.hash ?? '',
          chain,
          token,
          fromAddress: payerAddr,
          toAddress: adminAddr, // The admin is the logical recipient
          amount: amountNum,
          blockNumber: log.transaction?.block?.number ?? null,
          receivedAt: new Date(),
          raw: payload,
          adminAddress: adminAddr,
        };
      } catch {
        // Malformed log, skip
        continue;
      }
    }

    return null;
  }

  /**
   * Parse an Alchemy Notify address-activity webhook payload.
   * Returns null if it isn't a relevant USDT/USDC transfer.
   */
  private parseAddressActivity(chain: string, payload: unknown): IncomingCryptoTransfer | null {
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
