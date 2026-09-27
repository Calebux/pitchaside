import type {
  IGroup,
  IPlayer,
  ISession,
  IPayment,
  PaymentType,
  PaymentStatus,
  MemberRole,
} from '@pitchaside/shared';
import {
  PaymentType as PT,
  MemberRole as MR,
  SessionStatus,
  PaymentStatus as PS,
} from '@pitchaside/shared';
import {
  players,
  groups,
  sessions,
  payments,
} from './mock-data';

// ── Currency formatter ──

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

// ── Helpers ──

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function delay(ms = 120) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Groups ──

export async function getGroups(): Promise<IGroupWithMembers[]> {
  await delay();
  return groups;
}

export async function getGroup(id: string): Promise<IGroupWithMembers> {
  await delay();
  const group = groups.find((g) => g.id === id);
  if (!group) throw new Error('Group not found');
  return group;
}

export async function createGroup(data: {
  name: string;
  description?: string;
  schedule?: string;
  targetPlayers: number;
  feePerPlayer: number;
  paymentType?: PaymentType;
}): Promise<IGroup> {
  await delay();
  const group: IGroupWithMembers = {
    id: uuid(),
    name: data.name,
    description: data.description,
    schedule: data.schedule,
    targetPlayers: data.targetPlayers,
    feePerPlayer: data.feePerPlayer,
    paymentType: data.paymentType ?? PT.PER_SESSION,
    createdAt: new Date().toISOString(),
    memberships: [],
  };
  groups.push(group);
  return group;
}

export async function updateGroup(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    schedule: string;
    targetPlayers: number;
    feePerPlayer: number;
    paymentType: PaymentType;
  }>
): Promise<IGroup> {
  await delay();
  const group = groups.find((g) => g.id === id);
  if (!group) throw new Error('Group not found');
  Object.assign(group, data);
  return group;
}

export async function deleteGroup(id: string): Promise<void> {
  await delay();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx !== -1) groups.splice(idx, 1);
}

export async function addMember(
  groupId: string,
  data: { playerId: string; role?: MemberRole }
): Promise<void> {
  await delay();
  const group = groups.find((g) => g.id === groupId);
  if (!group) throw new Error('Group not found');
  const player = players.find((p) => p.id === data.playerId);
  if (!player) throw new Error('Player not found');
  if (!group.memberships) group.memberships = [];
  group.memberships.push({
    id: uuid(),
    role: data.role ?? MR.PLAYER,
    player,
    joinedAt: new Date().toISOString(),
  });
}

export async function removeMember(
  groupId: string,
  playerId: string
): Promise<void> {
  await delay();
  const group = groups.find((g) => g.id === groupId);
  if (!group || !group.memberships) return;
  group.memberships = group.memberships.filter(
    (m) => m.player.id !== playerId
  );
}

// ── Players ──

export async function getPlayers(): Promise<IPlayer[]> {
  await delay();
  return players;
}

export async function getPlayer(id: string): Promise<IPlayer> {
  await delay();
  const player = players.find((p) => p.id === id);
  if (!player) throw new Error('Player not found');
  return player;
}

export async function createPlayer(data: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}): Promise<IPlayer> {
  await delay();
  const player: IPlayer = {
    id: uuid(),
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: data.email,
    createdAt: new Date().toISOString(),
  };
  players.push(player);
  return player;
}

export async function updatePlayer(
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }>
): Promise<IPlayer> {
  await delay();
  const player = players.find((p) => p.id === id);
  if (!player) throw new Error('Player not found');
  Object.assign(player, data);
  return player;
}

export async function deletePlayer(id: string): Promise<void> {
  await delay();
  const idx = players.findIndex((p) => p.id === id);
  if (idx !== -1) players.splice(idx, 1);
}

// ── Sessions ──

export async function getSessions(
  groupId?: string
): Promise<ISessionWithDetails[]> {
  await delay();
  if (groupId) return sessions.filter((s) => s.groupId === groupId);
  return sessions;
}

export async function getSession(id: string): Promise<ISessionWithDetails> {
  await delay();
  const session = sessions.find((s) => s.id === id);
  if (!session) throw new Error('Session not found');
  return session;
}

export async function createSession(data: {
  groupId: string;
  date: string;
}): Promise<ISession> {
  await delay();
  const group = groups.find((g) => g.id === data.groupId);
  const targetAmount = group
    ? group.feePerPlayer * group.targetPlayers
    : 0;
  const sessionId = uuid();
  const session: ISessionWithDetails = {
    id: sessionId,
    groupId: data.groupId,
    date: data.date,
    targetAmount,
    collectedAmount: 0,
    status: SessionStatus.UPCOMING,
    group: group
      ? {
          id: group.id,
          name: group.name,
          description: group.description,
          schedule: group.schedule,
          targetPlayers: group.targetPlayers,
          feePerPlayer: group.feePerPlayer,
          paymentType: group.paymentType,
          createdAt: group.createdAt,
        }
      : undefined,
    payments: [],
  };

  // Auto-generate pending payments for each group member
  if (group?.memberships) {
    for (const m of group.memberships) {
      const payment: IPayment & { player?: IPlayer } = {
        id: uuid(),
        sessionId,
        playerId: m.player.id,
        amount: group.feePerPlayer,
        status: PS.PENDING,
        player: m.player,
      };
      payments.push(payment);
      session.payments!.push(payment);
    }
  }

  sessions.push(session);
  return session;
}

export async function updateSessionStatus(
  id: string,
  status: 'upcoming' | 'completed' | 'cancelled'
): Promise<ISessionWithDetails> {
  await delay();
  const session = sessions.find((s) => s.id === id);
  if (!session) throw new Error('Session not found');
  session.status = status as ISession['status'];
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  await delay();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx !== -1) sessions.splice(idx, 1);
}

// ── Payments ──

export async function getSessionPayments(
  sessionId: string
): Promise<IPayment[]> {
  await delay();
  return payments.filter((p) => p.sessionId === sessionId);
}

export async function getPlayerPayments(
  playerId: string
): Promise<IPayment[]> {
  await delay();
  return payments.filter((p) => p.playerId === playerId);
}

export async function createPayment(data: {
  sessionId: string;
  playerId: string;
  amount: number;
  status?: PaymentStatus;
}): Promise<IPayment> {
  await delay();
  const player = players.find((p) => p.id === data.playerId);
  const payment: IPayment & { player?: IPlayer } = {
    id: uuid(),
    sessionId: data.sessionId,
    playerId: data.playerId,
    amount: data.amount,
    status: data.status ?? PS.PENDING,
    player,
  };
  payments.push(payment);

  // Update session's payments array and collectedAmount
  const session = sessions.find((s) => s.id === data.sessionId);
  if (session) {
    if (!session.payments) session.payments = [];
    session.payments.push(payment);
    if (payment.status === PS.PAID) {
      session.collectedAmount += payment.amount;
    }
  }

  return payment;
}

export async function markPaid(paymentId: string): Promise<IPayment> {
  await delay();
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) throw new Error('Payment not found');

  const wasPaid = payment.status === PS.PAID;
  payment.status = PS.PAID;
  payment.paidAt = new Date().toISOString();

  // Update session collectedAmount if it wasn't already paid
  if (!wasPaid) {
    const session = sessions.find((s) => s.id === payment.sessionId);
    if (session) {
      session.collectedAmount += payment.amount;
    }
  }

  return payment;
}
