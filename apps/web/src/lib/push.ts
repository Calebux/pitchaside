/** Browser push helpers shared by the organiser app and the player home. */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export type PushState = 'unsupported' | 'insecure' | 'denied' | 'off' | 'on';

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Ask permission, subscribe this device, and hand the subscription to `save`. */
export async function enablePush(save: (sub: PushSubscriptionJSON) => Promise<unknown>): Promise<PushState> {
  if (!window.isSecureContext) return 'insecure';
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) return 'unsupported';
  const { publicKey } = await fetch(`${BASE_URL}/push/public-key`).then((r) => r.json());
  if (!publicKey) return 'unsupported';

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await save(sub.toJSON());
  return 'on';
}
