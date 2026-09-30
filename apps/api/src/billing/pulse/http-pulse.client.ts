import { createHmac, timingSafeEqual } from 'crypto';
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
 * Pulse's explanation for a rejected request, e.g. "Validation failed — bvn: bvn must be 11 digits".
 * Errors come back as { message, details: [{ field, message }] }; anything else is passed on as text.
 */
export async function pulseReason(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const json = JSON.parse(text) as { message?: unknown; details?: { field?: string; message?: string }[] };
    const message = Array.isArray(json.message) ? json.message.join('; ') : String(json.message ?? '');
    const details = (json.details ?? []).map((d) => [d.field, d.message].filter(Boolean).join(': ')).join('; ');
    const reason = [message, details].filter(Boolean).join(' — ');
    if (reason) return reason.slice(0, 300);
  } catch {
    /* not JSON — use the raw text */
  }
  return text.slice(0, 200) || 'no explanation given';
}

export interface HttpPulseConfig {
  baseUrl: string;
  publicKey: string;
  privateKey: string;
  webhookSecret: string;
}

/**
 * Live PulseMFB client.
 *
 * Authentication uses HMAC-SHA256 signatures:
 *   payload  = timestamp + method + path + body
 *   signature = HMAC-SHA256(privateKey, payload) → hex
 *
 * Headers: x-public-key, x-signature, x-timestamp
 */
export class HttpPulseClient implements PulseClient {
  readonly mode = 'live' as const;

  constructor(private readonly config: HttpPulseConfig) {}

  // ── Signature generation ──

  private sign(method: string, path: string, body: string): { signature: string; timestamp: string } {
    const timestamp = Date.now().toString();
    const payload = timestamp + method + path + body;
    const signature = createHmac('sha256', this.config.privateKey).update(payload).digest('hex');
    return { signature, timestamp };
  }

  private authHeaders(method: string, path: string, body: string): Record<string, string> {
    const { signature, timestamp } = this.sign(method, path, body);
    return {
      'Content-Type': 'application/json',
      'x-public-key': this.config.publicKey,
      'x-signature': signature,
      'x-timestamp': timestamp,
    };
  }

  // ── Account creation ──

  async createAccount(input: CreateAccountInput): Promise<ProvisionedAccount> {
    const path = '/api/v1/external-api/accounts/prefix';
    // Leave out what we don't have: an empty string is "provided" to Pulse's validation,
    // and "" is not a valid email, phone or 11-digit BVN.
    const body = JSON.stringify({
      customer_name: input.accountName,
      ...(input.phone ? { customer_phone: input.phone } : {}),
      ...(input.email ? { customer_email: input.email } : {}),
      ...(input.bvn ? { bvn: input.bvn } : {}),
      reference: input.reference,
    });

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders('POST', path, body),
      body,
    });

    if (!res.ok) throw new Error(`PulseMFB createAccount failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return {
      accountNumber: String(d.account_number),
      accountName: String(d.account_name ?? input.accountName),
      bankName: 'Pulse Microfinance Bank',
      providerReference: String(d.reference ?? input.reference),
    };
  }

  // ── Name enquiry ──

  async nameEnquiry(bankCode: string, accountNumber: string): Promise<NameEnquiryResult> {
    const path = '/api/v1/external-api/transfers/name-enquiry';
    const body = JSON.stringify({ accountNumber, bankCode });

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders('POST', path, body),
      body,
    });

    if (!res.ok) throw new Error(`PulseMFB name enquiry failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return { accountName: String(d.accountName ?? d.account_name ?? '') };
  }

  // ── Outbound transfers ──

  async transferOut(input: TransferOutInput): Promise<TransferOutResult> {
    const path = '/api/v1/external-api/transfers';
    const body = JSON.stringify({
      debit_account_number: input.debitAccountNumber,
      beneficiary_account_number: input.beneficiaryAccountNumber,
      beneficiary_bank_code: input.beneficiaryBankCode,
      amount: input.amount,
      narration: input.narration ?? '',
      reference: input.reference,
    });

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders('POST', path, body),
      body,
    });

    if (!res.ok) throw new Error(`PulseMFB transfer failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return {
      reference: String(d.reference ?? input.reference),
      status: String(d.status ?? 'pending'),
    };
  }

  async getTransfer(reference: string): Promise<TransferStatusResult> {
    const path = `/api/v1/external-api/transfers/${encodeURIComponent(reference)}`;

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers: this.authHeaders('GET', path, ''),
    });

    if (!res.ok) throw new Error(`PulseMFB transfer lookup failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return {
      status: String(d.status ?? 'unknown'),
      errorMessage: d.error_message ?? d.errorMessage,
    };
  }

  // ── Webhook verification ──

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
    if (!p || p.event !== 'transfer.completed' || !p.data) return null;
    const d = p.data;
    if (!d.credit_account || !d.amount) return null;
    return {
      providerTransactionId: String(d.reference),
      accountNumber: String(d.credit_account),
      amount: Number(d.amount),
      senderName: d.debit_account_name,
      senderAccount: d.debit_account,
      senderBank: d.debit_bank,
      narration: d.narration,
      receivedAt: d.completed_at ? new Date(d.completed_at) : new Date(),
      raw: payload,
    };
  }
}
