import type {
  IGroup,
  IPlayer,
  ISession,
  IPayment,
  PaymentType,
  PaymentStatus,
  MemberRole,
} from '@pitchaside/shared';
import { http } from './http';

// ── Currency formatter ──

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Pagination types ──

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Extended interfaces (unchanged — consumed by pages) ──

export interface IGroupWithMembers extends IGroup {
  memberships?: {
    id: string;
    role: MemberRole;
    player: IPlayer;
    joinedAt: string;
  }[];
}

export interface ISessionWithDetails extends ISession {
  group?: IGroup;
  payments?: (IPayment & { player?: IPlayer })[];
}

// ── Groups ──

export async function getGroups(): Promise<IGroupWithMembers[]> {
  const res = await http.get<PaginatedResponse<IGroupWithMembers>>('/groups');
  return res.data;
}

export function getGroup(id: string): Promise<IGroupWithMembers> {
  return http.get<IGroupWithMembers>(`/groups/${id}`);
}

export function createGroup(data: {
  name: string;
  description?: string;
  schedule?: string;
  targetPlayers: number;
  feePerPlayer: number;
  paymentType?: PaymentType;
}): Promise<IGroup> {
  return http.post<IGroup>('/groups', data);
}

export function updateGroup(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    schedule: string;
    targetPlayers: number;
    feePerPlayer: number;
    paymentType: PaymentType;
  }>,
): Promise<IGroup> {
  return http.patch<IGroup>(`/groups/${id}`, data);
}

export function deleteGroup(id: string): Promise<void> {
  return http.delete<void>(`/groups/${id}`);
}

export function addMember(
  groupId: string,
  data: { playerId: string; role?: MemberRole },
): Promise<void> {
  return http.post<void>(`/groups/${groupId}/members`, data);
}

export function removeMember(groupId: string, playerId: string): Promise<void> {
  return http.delete<void>(`/groups/${groupId}/members/${playerId}`);
}

// ── Players ──

export async function getPlayers(search?: string): Promise<IPlayer[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await http.get<PaginatedResponse<IPlayer>>(`/players${query}`);
  return res.data;
}

export function getPlayer(id: string): Promise<IPlayer> {
  return http.get<IPlayer>(`/players/${id}`);
}

export function createPlayer(data: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}): Promise<IPlayer> {
  return http.post<IPlayer>('/players', data);
}

export function updatePlayer(
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }>,
): Promise<IPlayer> {
  return http.patch<IPlayer>(`/players/${id}`, data);
}

export function deletePlayer(id: string): Promise<void> {
  return http.delete<void>(`/players/${id}`);
}

// ── Sessions ──

export async function getSessions(groupId?: string): Promise<ISessionWithDetails[]> {
  const query = groupId ? `?groupId=${groupId}` : '';
  const res = await http.get<PaginatedResponse<ISessionWithDetails>>(`/sessions${query}`);
  return res.data;
}

export function getSession(id: string): Promise<ISessionWithDetails> {
  return http.get<ISessionWithDetails>(`/sessions/${id}`);
}

export function createSession(data: { groupId: string; date: string }): Promise<ISession> {
  return http.post<ISession>('/sessions', data);
}

export function updateSessionStatus(
  id: string,
  status: 'upcoming' | 'completed' | 'cancelled',
): Promise<ISessionWithDetails> {
  return http.patch<ISessionWithDetails>(`/sessions/${id}/status`, { status });
}

export function deleteSession(id: string): Promise<void> {
  return http.delete<void>(`/sessions/${id}`);
}

// ── Payments ──

export function getSessionPayments(sessionId: string): Promise<IPayment[]> {
  return http.get<IPayment[]>(`/payments/session/${sessionId}`);
}

export function getPlayerPayments(playerId: string): Promise<IPayment[]> {
  return http.get<IPayment[]>(`/payments/player/${playerId}`);
}

export function createPayment(data: {
  sessionId: string;
  playerId: string;
  amount: number;
  status?: PaymentStatus;
}): Promise<IPayment> {
  return http.post<IPayment>('/payments', data);
}

export function markPaid(paymentId: string): Promise<IPayment> {
  return http.patch<IPayment>(`/payments/${paymentId}/mark-paid`);
}
