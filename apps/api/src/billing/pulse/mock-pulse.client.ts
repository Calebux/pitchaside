import { createHash, createHmac, timingSafeEqual } from 'crypto';
import {
  CreateAccountInput,
  IncomingTransfer,
  NameEnquiryResult,
  PulseClient,
  ProvisionedAccount,
  TransferOutInput,
  TransferOutResult,
  TransferStatusResult,
} from './pulse.client';

/**
 * Local stand-in for PulseMFB. Account numbers are deterministic per group so
 * re-provisioning is stable, and webhooks use a simple HMAC-SHA256 signature
 * over the raw body with PULSE_WEBHOOK_SECRET.
 */
export class MockPulseClient implements PulseClient {
  readonly mode = 'mock' as const;

  constructor(private readonly webhookSecret: string) {}

  async createAccount(input: CreateAccountInput): Promise<ProvisionedAccount> {
    const digest = createHash('sha256').update(input.reference).digest();
    // 10-digit NUBAN-style number; leading 8 keeps it visibly "test".
    const digits = Array.from(digest.subarray(0, 9), (b) => String(b % 10)).join('');
    return {
      accountNumber: `8${digits}`,
      accountName: input.accountName,
      bankName: 'Payrep MFB (test)',
      providerReference: `mock_${digest.toString('hex').slice(0, 16)}`,
    };
  }

  async nameEnquiry(_bankCode: string, accountNumber: string): Promise<NameEnquiryResult> {
    // Return a fake but plausible name based on the account number.
    return { accountName: `Test Account ${accountNumber.slice(-4)}` };
  }

  async transferOut(input: TransferOutInput): Promise<TransferOutResult> {
    // Mock payouts complete immediately.
    return { reference: input.reference, status: 'completed' };
  }

  async getBalance(): Promise<number | null> {
    return null;
  }

  async getTransfer(reference: string): Promise<TransferStatusResult> {
    return { status: 'completed' };
  }

  sign(rawBody: string) {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  verifyWebhook(rawBody: string, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = Buffer.from(this.sign(rawBody));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  parseWebhook(payload: unknown): IncomingTransfer | null {
    const p = payload as Record<string, any>;
    if (!p || p.event !== 'transfer.received' || !p.data) return null;
    const d = p.data;
    return {
      providerTransactionId: String(d.transactionId),
      accountNumber: String(d.accountNumber),
      amount: Number(d.amount),
      senderName: d.senderName,
      senderAccount: d.senderAccount,
      senderBank: d.senderBank,
      narration: d.narration,
      receivedAt: d.receivedAt ? new Date(d.receivedAt) : new Date(),
      raw: payload,
    };
  }
}
