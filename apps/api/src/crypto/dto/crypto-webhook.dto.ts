/** Webhook payloads are validated by signature, not by DTO shape — they're opaque JSON from the monitoring service. */
export type CryptoWebhookPayload = unknown;
