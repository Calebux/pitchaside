import type {
  IGroup,
  IPlayer,
  ISession,
  IPayment,
  PaymentType,
  PaymentStatus,
  MemberRole,
} from '@pitchaside/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Groups ──

export interface IGroupWithMembers extends IGroup {
  memberships?: {
    id: string;
    role: MemberRole;
    player: IPlayer;
    joinedAt: string;
  }[];
}

export function getGroups() {
  return apiFetch<IGroupWithMembers[]>('/groups');
}

export function getGroup(id: string) {
  return apiFetch<IGroupWithMembers>(`/groups/${id}`);
}

export function createGroup(data: {
  name: string;
  description?: string;
  schedule?: string;
  targetPlayers: number;
  feePerPlayer: number;
  paymentType?: PaymentType;
}) {
  return apiFetch<IGroup>('/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteGroup(id: string) {
  return apiFetch<void>(`/groups/${id}`, { method: 'DELETE' });
}

export function addMember(groupId: string, data: { playerId: string; role?: MemberRole }) {
  return apiFetch(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function removeMember(groupId: string, playerId: string) {
  return apiFetch(`/groups/${groupId}/members/${playerId}`, { method: 'DELETE' });
}

// ── Players ──

export function getPlayers() {
  return apiFetch<IPlayer[]>('/players');
}

export function getPlayer(id: string) {
  return apiFetch<IPlayer>(`/players/${id}`);
}

export function createPlayer(data: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}) {
  return apiFetch<IPlayer>('/players', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deletePlayer(id: string) {
  return apiFetch<void>(`/players/${id}`, { method: 'DELETE' });
}

// ── Sessions ──

export interface ISessionWithDetails extends ISession {
  group?: IGroup;
  payments?: (IPayment & { player?: IPlayer })[];
}

export function getSessions(groupId?: string) {
  const query = groupId ? `?groupId=${groupId}` : '';
  return apiFetch<ISessionWithDetails[]>(`/sessions${query}`);
}

export function getSession(id: string) {
  return apiFetch<ISessionWithDetails>(`/sessions/${id}`);
}

export function createSession(data: { groupId: string; date: string }) {
  return apiFetch<ISession>('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteSession(id: string) {
  return apiFetch<void>(`/sessions/${id}`, { method: 'DELETE' });
}

// ── Payments ──

export function getSessionPayments(sessionId: string) {
  return apiFetch<IPayment[]>(`/payments/session/${sessionId}`);
}

export function getPlayerPayments(playerId: string) {
  return apiFetch<IPayment[]>(`/payments/player/${playerId}`);
}

export function createPayment(data: {
  sessionId: string;
  playerId: string;
  amount: number;
  status?: PaymentStatus;
}) {
  return apiFetch<IPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function markPaid(paymentId: string) {
  return apiFetch<IPayment>(`/payments/${paymentId}/mark-paid`, {
    method: 'PATCH',
  });
}
