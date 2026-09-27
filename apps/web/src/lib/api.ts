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

export function createSession(data: {
  groupId: string;
  date: string;
  recurrenceType?: string;
  recurrenceCount?: number;
}): Promise<ISession> {
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

export function waivePayment(paymentId: string): Promise<IPayment> {
  return http.patch<IPayment>(`/payments/${paymentId}/waive`);
}

export function bulkMarkPaid(paymentIds: string[]): Promise<IPayment[]> {
  return http.patch<IPayment[]>('/payments/bulk-mark-paid', { paymentIds });
}

// ── Paginated functions ──

export function getGroupsPaginated(
  page = 1,
  limit = 10,
  search?: string,
): Promise<PaginatedResponse<IGroupWithMembers>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return http.get<PaginatedResponse<IGroupWithMembers>>(`/groups?${params}`);
}

export function getPlayersPaginated(
  page = 1,
  limit = 10,
  search?: string,
): Promise<PaginatedResponse<IPlayer>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return http.get<PaginatedResponse<IPlayer>>(`/players?${params}`);
}

// ── Profile / Auth ──

export function updateProfile(data: { firstName: string; lastName: string }): Promise<any> {
  return http.patch('/auth/profile', data);
}

export function changePassword(data: { currentPassword: string; newPassword: string }): Promise<any> {
  return http.post('/auth/change-password', data);
}

// ── CSV Export ──

export async function downloadCsv(path: string, filename: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('pitchaside_token') : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportGroupsCsv() {
  return downloadCsv('/groups/export', 'groups.csv');
}

export function exportPlayersCsv() {
  return downloadCsv('/players/export', 'players.csv');
}

export function exportSessionPaymentsCsv(sessionId: string) {
  return downloadCsv(`/sessions/${sessionId}/export`, 'session-payments.csv');
}

// ── Reminders ──

export function sendReminders(sessionId: string): Promise<{ sent: number }> {
  return http.post<{ sent: number }>(`/sessions/${sessionId}/send-reminders`);
}

// ── Player Stats ──

export function getPlayerStats(playerId: string): Promise<{
  totalSessions: number;
  totalPaid: number;
  totalOwed: number;
  paymentRate: number;
}> {
  return http.get(`/players/${playerId}/stats`);
}

// ── 2FA ──

export function setup2FA(): Promise<{ qrCodeUrl: string; secret: string }> {
  return http.post('/auth/2fa/setup');
}

export function verify2FA(code: string): Promise<{ message: string }> {
  return http.post('/auth/2fa/verify', { code });
}

export function disable2FA(code: string): Promise<{ message: string }> {
  return http.post('/auth/2fa/disable', { code });
}

export function validate2FALogin(userId: string, code: string): Promise<any> {
  return http.post('/auth/2fa/validate', { userId, code });
}

export function getSessionsPaginated(
  page = 1,
  limit = 10,
  groupId?: string,
): Promise<PaginatedResponse<ISessionWithDetails>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (groupId) params.set('groupId', groupId);
  return http.get<PaginatedResponse<ISessionWithDetails>>(`/sessions?${params}`);
}
