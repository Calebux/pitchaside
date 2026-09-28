/**
 * WhatsApp / SMS delivery boundary. MockMessagingProvider (MESSAGING_MODE=mock)
 * only records messages so they can be read in Admin → Messages; the Termii
 * provider sends for real.
 */

export const MESSAGING_PROVIDER = Symbol('MESSAGING_PROVIDER');

export type Channel = 'whatsapp' | 'sms';

export interface MessagingProvider {
  readonly name: string;
  readonly mode: 'mock' | 'live';
  send(input: { to: string; body: string; channel: Channel }): Promise<void>;
}

export class MockMessagingProvider implements MessagingProvider {
  readonly name = 'mock';
  readonly mode = 'mock' as const;
  async send() {
    /* recorded by NotificationsService; nothing leaves the server */
  }
}

/**
 * Termii (Nigerian SMS/WhatsApp gateway).
 * TODO(termii): confirm sender ID approval and the WhatsApp channel on the
 * account; WhatsApp business messages may require pre-approved templates.
 */
export class TermiiMessagingProvider implements MessagingProvider {
  readonly name = 'termii';
  readonly mode = 'live' as const;

  constructor(private readonly apiKey: string, private readonly senderId: string) {}

  async send({ to, body, channel }: { to: string; body: string; channel: Channel }) {
    const res = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        to: to.replace(/\D/g, ''),
        from: this.senderId,
        sms: body,
        type: 'plain',
        channel: channel === 'whatsapp' ? 'whatsapp' : 'generic',
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Termii ${res.status}: ${text.slice(0, 200)}`);
    }
  }
}
