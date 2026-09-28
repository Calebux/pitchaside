/**
 * Payrep Microfinance Bank integration boundary.
 *
 * Everything the app needs from Payrep goes through this interface so the
 * real HTTP client can be dropped in without touching billing logic. Until
 * the API contract is confirmed we run the MockPayrepClient (PAYREP_MODE=mock).
 */

export const PAYREP_CLIENT = Symbol('PAYREP_CLIENT');

export interface CreateAccountInput {
  /** Our stable reference for the account owner (the group id). */
  reference: string;
  /** Name the account should carry, e.g. "PitchAside – Tuesday Night 5s". */
  accountName: string;
  /** Organisation contact, if the provider requires KYC-lite details. */
  email?: string;
}

export interface ProvisionedAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  /** Provider's own id for the account. */
  providerReference: string;
}

/** A credit into one of our accounts, normalised from the provider's webhook. */
export interface IncomingTransfer {
  providerTransactionId: string;
  accountNumber: string;
  amount: number;
  senderName?: string;
  senderAccount?: string;
  senderBank?: string;
  narration?: string;
  receivedAt: Date;
  raw: unknown;
}

export interface PayrepClient {
  readonly mode: 'mock' | 'live';
  createAccount(input: CreateAccountInput): Promise<ProvisionedAccount>;
  /** Returns true when the webhook signature is valid for the raw body. */
  verifyWebhook(rawBody: string, signature: string | undefined): boolean;
  /** Maps the provider's webhook payload to our shape; null if it isn't a credit. */
  parseWebhook(payload: unknown): IncomingTransfer | null;
}
