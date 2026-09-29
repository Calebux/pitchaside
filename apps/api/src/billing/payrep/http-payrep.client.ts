import { createHmac, timingSafeEqual } from 'crypto';
import {
  CreateAccountInput,
  IncomingTransfer,
  PayrepClient,
  ProvisionedAccount,
} from './payrep.client';

export interface HttpPayrepConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
}

/**
 * Live Payrep client.
 *
 * TODO(payrep): the endpoint paths, auth header, payload fields and webhook
 * signature scheme below are placeholders — confirm them against Payrep's API
 * docs and adjust the mapping. Nothing outside this file needs to change.
 */
export class HttpPayrepClient implements PayrepClient {
  readonly mode = 'live' as const;

  constructor(private readonly config: HttpPayrepConfig) {}

  async createAccount(input: CreateAccountInput): Promise<ProvisionedAccount> {
    const res = await fetch(`${this.config.baseUrl}/virtual-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        reference: input.reference,
        account_name: input.accountName,
        email: input.email,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Payrep createAccount failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as Record<string, any>;
    const d = body.data ?? body;
    return {
      accountNumber: String(d.account_number),
      accountName: String(d.account_name ?? input.accountName),
      bankName: String(d.bank_name ?? 'Payrep Microfinance Bank'),
      providerReference: String(d.id ?? d.reference ?? input.reference),
    };
  }

  verifyWebhook(rawBody: string, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = Buffer.from(
      createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex'),
    );
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  parseWebhook(payload: unknown): IncomingTransfer | null {
    const p = payload as Record<string, any>;
    const d = p?.data;
    if (!d || !d.account_number || !d.amount) return null;
    return {
      providerTransactionId: String(d.transaction_id ?? d.id),
      accountNumber: String(d.account_number),
      amount: Number(d.amount),
      senderName: d.sender_name,
      senderAccount: d.sender_account_number,
      senderBank: d.sender_bank,
      narration: d.narration,
      receivedAt: d.created_at ? new Date(d.created_at) : new Date(),
      raw: payload,
    };
  }
}
