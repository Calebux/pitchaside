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

  private readonly baseUrl: string;

  constructor(private readonly config: HttpPulseConfig) {
    // Every path below starts with /api/v1/external-api, so the base is just the host. Accept a
    // base that already includes that prefix too: production had one, and every request 404'd
    // on /api/v1/external-api/api/v1/external-api/…
    this.baseUrl = config.baseUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1\/external-api$/, '').replace(/\/+$/, '');
  }

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

  // ── Prefixes ──

  private cachedPrefixId: string | null = null;

  private async getPrefixId(): Promise<string> {
    if (this.cachedPrefixId) return this.cachedPrefixId;

    const path = '/api/v1/external-api/accounts/prefixes';
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.authHeaders('GET', path, ''),
    });

    if (!res.ok) throw new Error(`PulseMFB getPrefixes failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const prefixes = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    console.log('[Pulse] prefixes response:', JSON.stringify(json, null, 2));

    const active = prefixes.find((p: any) => p.account_number === '1008618754')
      ?? prefixes.find((p: any) => p.status === 'active')
      ?? prefixes[0];
    if (!active) throw new Error('No active prefix found on PulseMFB account');

    this.cachedPrefixId = String(active._id ?? active.id ?? active.prefix_id);
    return this.cachedPrefixId;
  }

  // ── Account creation ──

  async createAccount(input: CreateAccountInput): Promise<ProvisionedAccount> {
    const prefixId = await this.getPrefixId();
    const path = '/api/v1/external-api/accounts/prefix';
    const body = JSON.stringify({
      customer_name: input.accountName,
      ...(input.phone ? { customer_phone: input.phone } : {}),
      ...(input.email ? { customer_email: input.email } : {}),
      ...(input.bvn ? { bvn: input.bvn } : {}),
      sweep_mode: 'manual',
      use_prefix: true,
      prefix_id: prefixId,
      reference: input.reference,
    });

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders('POST', path, body),
      body,
    });

    if (!res.ok) throw new Error(`Payrep MFB createAccount failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return {
      accountNumber: String(d.account_number),
      accountName: String(d.account_name ?? input.accountName),
      bankName: 'Payrep Microfinance Bank',
      providerReference: String(d.reference ?? input.reference),
    };
  }

  // ── Name enquiry ──

  async nameEnquiry(bankCode: string, accountNumber: string): Promise<NameEnquiryResult> {
    const path = '/api/v1/external-api/transfers/name-enquiry';
    const body = JSON.stringify({ accountNumber, bankCode });

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders('POST', path, body),
      body,
    });

    if (!res.ok) throw new Error(`Payrep MFB name enquiry failed (${res.status}): ${await pulseReason(res)}`);

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

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders('POST', path, body),
      body,
    });

    if (!res.ok) throw new Error(`Payrep MFB transfer failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return {
      reference: String(d.reference ?? input.reference),
      status: String(d.status ?? 'pending'),
    };
  }

  async getTransfer(reference: string): Promise<TransferStatusResult> {
    const path = `/api/v1/external-api/transfers/${encodeURIComponent(reference)}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.authHeaders('GET', path, ''),
    });

    if (!res.ok) throw new Error(`Payrep MFB transfer lookup failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return {
      status: String(d.status ?? 'unknown'),
      errorMessage: d.error_message ?? d.errorMessage,
    };
  }

  async getBalance(accountNumber: string): Promise<number> {
    const path = `/api/v1/external-api/accounts/${encodeURIComponent(accountNumber)}/balance`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.authHeaders('GET', path, ''),
    });

    if (!res.ok) throw new Error(`PulseMFB balance failed (${res.status}): ${await pulseReason(res)}`);

    const json = (await res.json()) as Record<string, any>;
    const d = json.data ?? json;
    return Number(d.available_balance ?? d.availableBalance ?? d.balance ?? 0);
  }

  // ── Webhook verification ──

  /**
   * Pulse's docs sign JSON.stringify(parsed body), which differs from the raw bytes
   * if the body was sent with other spacing, so accept a signature over either.
   */
  verifyWebhook(rawBody: string, signature: string | undefined): boolean {
    if (!signature) return false;
    const given = Buffer.from(signature.trim().toLowerCase());
    const candidates = [rawBody];
    try {
      candidates.push(JSON.stringify(JSON.parse(rawBody)));
    } catch {
      /* not JSON — only the raw form can match */
    }
    return candidates.some((body) => {
      const expected = Buffer.from(createHmac('sha256', this.config.webhookSecret).update(body).digest('hex'));
      return expected.length === given.length && timingSafeEqual(expected, given);
    });
  }

  /**
   * A successful credit, whatever the event is called. The docs only show `transfer.completed`
   * (for transfers made from an account); money arriving in a prefix account may use another
   * name. BillingService decides whether the credited account is one of ours.
   */
  parseWebhook(payload: unknown): IncomingTransfer | null {
    const p = payload as Record<string, any>;
    if (!p || typeof p !== 'object') return null;
    const event = String(p.event ?? p.event_type ?? p.type ?? '').toLowerCase();
    if (/^(vas|account\.created|webhook\.test)/.test(event) || /fail|revers/.test(event)) return null;

    const d = (p.data ?? p) as Record<string, any>;
    const account = d.credit_account ?? d.creditAccount ?? d.account_number ?? d.accountNumber ?? d.beneficiary_account_number;
    const amount = Number(d.amount);
    const status = String(d.status ?? 'completed').toLowerCase();
    if (!account || !(amount > 0) || /fail|revers|declin|pending/.test(status)) return null;

    return {
      providerTransactionId: String(d.reference ?? d.transaction_reference ?? d.session_id ?? d.id),
      accountNumber: String(account),
      amount,
      senderName: d.debit_account_name ?? d.sender_name ?? d.senderName ?? d.originator_name,
      senderAccount: d.debit_account ?? d.sender_account ?? d.senderAccount,
      senderBank: d.debit_bank ?? d.sender_bank ?? d.senderBank,
      narration: d.narration ?? d.description,
      receivedAt: new Date(d.completed_at ?? d.created_at ?? p.timestamp ?? Date.now()),
      raw: payload,
    };
  }
}
