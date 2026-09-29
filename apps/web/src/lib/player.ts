/**
 * Player-side API client. Players sign in with a one-time code and get their
 * own token (separate from the organiser's), stored under its own key.
 */
import type { PaymentType } from '@pitchaside/shared';
import type { PlayerRatings, VoteCategory, VoteResults, GroupAccount, PublicGroup } from './api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const TOKEN_KEY = 'pitchaside_player_token';

export function getPlayerToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPlayerToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode — session only */
  }
}

export function clearPlayerToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class PlayerAuthError extends Error {}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const token = auth ? getPlayerToken() : null;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && auth) {
    clearPlayerToken();
    throw new PlayerAuthError('Please sign in again');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

// ── Sign-in ──

export type SignInResult = { phoneProof: string; token?: string; player?: { id: string; firstName: string } };

/** 'phone' = number only; 'otp' = 6-digit code by WhatsApp/SMS. Set on the server. */
export function getAuthMode() {
  return request<{ mode: 'phone' | 'otp' }>('GET', '/player-auth/mode', undefined, false);
}

export function signInWithPhone(phone: string, groupCode?: string) {
  return request<SignInResult>('POST', '/player-auth/phone', { phone, groupCode }, false);
}

export function requestCode(phone: string, groupCode?: string) {
  return request<{ sent: boolean; isNewPlayer: boolean; devCode?: string }>(
    'POST',
    '/player-auth/request-code',
    { phone, groupCode },
    false,
  );
}

export function verifyCode(phone: string, code: string) {
  return request<SignInResult>(
    'POST',
    '/player-auth/verify',
    { phone, code },
    false,
  );
}

export type JoinResult = PublicGroup & {
  paymentRef: string;
  firstName: string;
  alreadyMember: boolean;
  token?: string;
};

export function joinWithProof(
  code: string,
  data: { phoneProof: string; firstName?: string; lastName?: string; email?: string },
) {
  return request<JoinResult>('POST', `/public/groups/${code}/join`, data, false);
}

export function joinAsPlayer(code: string) {
  return request<JoinResult>('POST', `/me/groups/${code}/join`);
}

// ── Home ──

export type PlayerGroup = {
  id: string;
  name: string;
  clubName?: string;
  schedule?: string;
  kickoffTime?: string | null;
  feePerPlayer: number;
  paymentType: PaymentType;
  paymentRef?: string;
  account: GroupAccount | null;
};

export type Organiser = { clubName: string; email: string } | null;

export interface PlayerHome {
  player: { id: string; firstName: string; lastName: string; phone: string };
  organiser: Organiser;
  groups: {
    id: string;
    name: string;
    clubName?: string;
    kickoffTime?: string | null;
    schedule?: string;
    feePerPlayer: number;
    paymentType: PaymentType;
    paymentRef?: string;
    account: GroupAccount | null;
  }[];
  upcoming: {
    id: string;
    date: string;
    groupId: string;
    groupName: string;
    schedule?: string;
    kickoffTime?: string | null;
    requireRsvp: boolean;
    myStatus: 'in' | 'out' | 'waitlist' | null;
    waitlistPosition: number | null;
    confirmed: number;
    capacity: number;
    waitlist: number;
    payment: { status: 'paid' | 'pending' | 'waived'; amount: number } | null;
  }[];
  owed: { id: string; amount: number; groupId: string; groupName: string; label: string | null; date: string }[];
  openVotes: { token: string; sessionId: string; groupName?: string; date: string; voted: boolean }[];
  ratings: PlayerRatings;
  tables: {
    groupId: string;
    groupName: string;
    games: number;
    myPlayerId: string;
    top: { rank: number; id: string; name: string; points: number }[];
    me: { rank: number; points: number } | null;
  }[];
}

export type UpcomingGame = PlayerHome['upcoming'][number];

export interface RecentMatchDay {
  sessionId: string;
  date: string;
  groupName?: string;
  teamCount: number;
  myTeam: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null;
  teamOfTheDay: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null;
  record: { w: number; d: number; l: number };
  games: number;
  potm: { name: string; votes: number; isMe: boolean } | null;
  vote: { token: string; voted: boolean } | null;
}

export function getPlayerGames() {
  return request<{ upcoming: UpcomingGame[]; recent: RecentMatchDay[] }>('GET', '/me/games');
}

export interface PlayerPayments {
  owed: PlayerHome['owed'];
  paid: { id: string; amount: number; groupName: string; label: string | null; date: string; paidAt: string | null; viaTransfer: boolean }[];
  groups: PlayerGroup[];
}

export function getPlayerPayments() {
  return request<PlayerPayments>('GET', '/me/payments');
}

export interface PlayerProfile {
  player: PlayerHome['player'];
  organiser: Organiser;
  ratings: PlayerRatings;
  clubs: { clubName: string; ratings: PlayerRatings; groups: { id: string; name: string }[] }[];
}

export function getPlayerProfile() {
  return request<PlayerProfile>('GET', '/me/profile');
}

export function startGroup(data: { clubName: string; email: string; password: string }) {
  return request<{ accessToken: string; user: unknown }>('POST', '/me/start-group', data);
}

export function getPlayerHome() {
  return request<PlayerHome>('GET', '/me');
}

export function setRsvp(sessionId: string, status: 'in' | 'out') {
  return request<{ status: 'in' | 'out' | 'waitlist' }>('POST', `/me/sessions/${sessionId}/rsvp`, { status });
}

// ── Voting ──

export function getMyBallot(token: string) {
  return request<{ playerId: string; firstName: string; picks: Partial<Record<VoteCategory, string>> }>(
    'GET',
    `/me/votes/${token}`,
  );
}

export function submitMyVotes(token: string, picks: Partial<Record<VoteCategory, string>>) {
  return request<VoteResults>('POST', `/me/votes/${token}`, { picks });
}

// ── Push ──

export function subscribePlayerPush(sub: PushSubscriptionJSON) {
  return request('POST', '/me/push', sub);
}
