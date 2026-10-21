/**
 * Blockchain interaction boundary — parallel to pulse.client.ts for bank transfers.
 *
 * Each chain family (EVM, Tron, Solana) implements this interface so the crypto
 * service doesn't know which chain is being used.
 */

export const CRYPTO_CLIENT = Symbol('CRYPTO_CLIENT');

export interface DerivedAddress {
  address: string;
}

/** A normalised incoming crypto transfer parsed from a monitoring webhook. */
export interface IncomingCryptoTransfer {
  txHash: string;
  chain: string;
  token: 'USDT' | 'USDC';
  fromAddress: string | null;
  toAddress: string;
  amount: number;
  blockNumber: number | null;
  receivedAt: Date;
  raw: unknown;
}

export interface CryptoClient {
  readonly chainFamily: 'evm' | 'tron' | 'solana';

  /** Derive a wallet address at the given HD index. */
  deriveAddress(index: number): DerivedAddress;

  /** Get the USDT or USDC balance for an address on a specific chain. */
  getTokenBalance(chain: string, address: string, token: 'USDT' | 'USDC'): Promise<number>;

  /** Send tokens from a group wallet (by derivation index) to a beneficiary address. */
  sendTokens(chain: string, fromIndex: number, to: string, token: string, amount: number): Promise<{ txHash: string }>;

  /** Verify a webhook signature from the monitoring service. */
  verifyWebhook(rawBody: string, signature: string): boolean;

  /** Parse a monitoring webhook payload into a normalised transfer (null if not relevant). */
  parseWebhook(chain: string, payload: unknown): IncomingCryptoTransfer | null;
}
