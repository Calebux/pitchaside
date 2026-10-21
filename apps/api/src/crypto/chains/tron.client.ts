import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { CryptoClient, DerivedAddress, IncomingCryptoTransfer } from '../crypto-client';
import { CHAINS } from './chain-registry';

/**
 * Tron wallet operations using TronWeb.
 *
 * TronWeb is imported dynamically because it's a CJS module with some ESM quirks.
 * In Phase 1 this handles TRC-20 USDT/USDC on the Tron network.
 */
export class TronClient implements CryptoClient {
  readonly chainFamily = 'tron' as const;
  private readonly logger = new Logger(TronClient.name);
  private tronWeb: any;

  constructor(
    private readonly masterSeed: string,
    private readonly webhookSecret: string,
    private readonly tronGridApiKey: string,
  ) {}

  private async getTronWeb() {
    if (this.tronWeb) return this.tronWeb;
    // tronweb exports { TronWeb, utils, ... } — the constructor is the named export.
    const mod = await import('tronweb');
    const Ctor = (mod as any).TronWeb ?? (mod as any).default?.TronWeb ?? (mod as any).default;
    this.tronWeb = new Ctor({
      fullHost: 'https://api.trongrid.io',
      headers: { 'TRON-PRO-API-KEY': this.tronGridApiKey },
    });
    return this.tronWeb;
  }

  deriveAddress(index: number): DerivedAddress {
    // Tron uses BIP44 path m/44'/195'/0'/0/{index}
    // Derive from master seed with ethers, then convert the key to a Tron address.
    const { ethers } = require('ethers') as typeof import('ethers');
    const seed = Buffer.from(this.masterSeed, 'hex');
    const root = ethers.HDNodeWallet.fromSeed(seed);
    const child = root.derivePath(`m/44'/195'/0'/0/${index}`);

    // tronweb.address.fromPrivateKey converts a secp256k1 private key to a Tron base58 address.
    const tw = require('tronweb');
    const fromPk = tw.TronWeb?.address?.fromPrivateKey ?? tw.address?.fromPrivateKey;
    const address = fromPk ? fromPk(child.privateKey.slice(2)) : '';

    return { address: address || '' };
  }

  async getTokenBalance(chain: string, address: string, token: 'USDT' | 'USDC'): Promise<number> {
    const tronWeb = await this.getTronWeb();
    const tokenAddress = CHAINS.tron?.tokens[token];
    if (!tokenAddress) return 0;

    try {
      const contract = await tronWeb.contract().at(tokenAddress);
      const balance = await contract.balanceOf(address).call();
      const decimals = await contract.decimals().call();
      return Number(balance) / Math.pow(10, Number(decimals));
    } catch (err) {
      this.logger.warn(`Failed to get ${token} balance on Tron for ${address}: ${err}`);
      return 0;
    }
  }

  async sendTokens(
    chain: string,
    fromIndex: number,
    to: string,
    token: string,
    amount: number,
  ): Promise<{ txHash: string }> {
    const tronWeb = await this.getTronWeb();
    const tokenAddress = CHAINS.tron?.tokens[token as 'USDT' | 'USDC'];
    if (!tokenAddress) throw new Error(`Token ${token} not supported on Tron`);

    // Derive the private key for signing
    const { ethers } = require('ethers') as typeof import('ethers');
    const seed = Buffer.from(this.masterSeed, 'hex');
    const root = ethers.HDNodeWallet.fromSeed(seed);
    const child = root.derivePath(`m/44'/195'/0'/0/${fromIndex}`);
    const privateKey = child.privateKey.slice(2);

    tronWeb.setPrivateKey(privateKey);
    const contract = await tronWeb.contract().at(tokenAddress);
    const decimals = await contract.decimals().call();
    const rawAmount = Math.round(amount * Math.pow(10, Number(decimals)));

    const tx = await contract.transfer(to, rawAmount).send();
    return { txHash: tx };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /**
   * Parse a TronGrid event webhook for TRC-20 transfers.
   */
  parseWebhook(chain: string, payload: unknown): IncomingCryptoTransfer | null {
    if (chain !== 'tron') return null;
    const data = payload as {
      transaction_id?: string;
      contract_address?: string;
      from?: string;
      to?: string;
      value?: string;
      block_number?: number;
      block_timestamp?: number;
    };

    if (!data?.transaction_id || !data?.contract_address) return null;

    const tronConfig = CHAINS.tron;
    if (!tronConfig) return null;

    let token: 'USDT' | 'USDC' | null = null;
    if (tronConfig.tokens.USDT === data.contract_address) token = 'USDT';
    else if (tronConfig.tokens.USDC === data.contract_address) token = 'USDC';
    if (!token) return null;

    const amount = data.value ? Number(data.value) / 1e6 : 0;

    return {
      txHash: data.transaction_id,
      chain: 'tron',
      token,
      fromAddress: data.from ?? null,
      toAddress: data.to ?? '',
      amount,
      blockNumber: data.block_number ?? null,
      receivedAt: data.block_timestamp ? new Date(data.block_timestamp) : new Date(),
      raw: payload,
    };
  }
}
