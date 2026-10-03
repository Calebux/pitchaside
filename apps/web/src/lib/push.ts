/** Browser push helpers shared by the organiser app and the player home. */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export type PushState = 'unsupported' | 'insecure' | 'denied' | 'off' | 'on' | 'ready' | 'unconfigured';

function hasPushManager() {
  return (
    'PushManager' in window ||
    (typeof ServiceWorkerRegistration !== 'undefined' && 'pushManager' in ServiceWorkerRegistration.prototype)
  );
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && hasPushManager() && 'Notification' in window;
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

/** Ask for notification permission. iOS may require subscription in a second tap. */
export async function requestPushPermission(): Promise<PushState> {
  if (!window.isSecureContext) return 'insecure';
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  return 'ready';
}

async function getPublicKey(): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/push/public-key`);
  if (!response.ok) return null;
  const { publicKey } = await response.json();
  return publicKey || null;
}

/** Subscribe this device and hand the subscription to `save`. */
export async function subscribePush(save: (sub: PushSubscriptionJSON) => Promise<unknown>): Promise<PushState> {
  if (!window.isSecureContext) return 'insecure';
  if (!pushSupported()) return 'unsupported';

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) return 'unsupported';
  const publicKey = await getPublicKey();
  if (!publicKey) return 'unconfigured';

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await save(sub.toJSON());
  return 'on';
}

/** Ask permission, subscribe this device, and hand the subscription to `save`. */
export async function enablePush(save: (sub: PushSubscriptionJSON) => Promise<unknown>): Promise<PushState> {
  const permission = await requestPushPermission();
  return permission === 'ready' ? subscribePush(save) : permission;
}
