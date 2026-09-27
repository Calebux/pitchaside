import {
  PaymentType,
  MemberRole,
  SessionStatus,
  PaymentStatus,
} from '@pitchaside/shared';
import type { IGroup, IPlayer, IPayment } from '@pitchaside/shared';
import type { IGroupWithMembers, ISessionWithDetails } from './api';

// ── Players ──

export const players: IPlayer[] = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    firstName: 'Tunde',
    lastName: 'Adeyemi',
    phone: '+2348012345678',
    email: 'tunde.adeyemi@email.com',
    createdAt: '2026-08-10T09:00:00.000Z',
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    firstName: 'Chidi',
    lastName: 'Okonkwo',
    phone: '+2348023456789',
    email: 'chidi.okonkwo@email.com',
    createdAt: '2026-08-12T14:30:00.000Z',
  },
  {
    id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    firstName: 'Amina',
    lastName: 'Bello',
    phone: '+2348034567890',
    createdAt: '2026-08-15T11:00:00.000Z',
  },
  {
    id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
    firstName: 'Kemi',
    lastName: 'Fashola',
    phone: '+2348045678901',
    email: 'kemi.fashola@email.com',
    createdAt: '2026-08-20T16:45:00.000Z',
  },
];

// ── Groups ──

export const groups: IGroupWithMembers[] = [
  {
    id: 'g1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    name: 'Saturday Morning Ballers',
    description: 'Weekend football at Teslim Balogun Stadium. Bring boots and water.',
    schedule: 'Every Saturday, 7:00 AM',
    targetPlayers: 10,
    feePerPlayer: 2000,
    paymentType: PaymentType.PER_SESSION,
    createdAt: '2026-08-10T08:00:00.000Z',
    memberships: [
      {
        id: 'm1a1a1a1-b2b2-4c3c-d4d4-e5e5f6f6a7a7',
        role: MemberRole.ORGANIZER,
        player: players[0],
        joinedAt: '2026-08-10T08:00:00.000Z',
      },
      {
        id: 'm2b2b2b2-c3c3-4d4d-e5e5-f6f6a7a7b8b8',
        role: MemberRole.PLAYER,
        player: players[1],
        joinedAt: '2026-08-12T14:30:00.000Z',
      },
      {
        id: 'm3c3c3c3-d4d4-4e5e-f6f6-a7a7b8b8c9c9',
        role: MemberRole.PLAYER,
        player: players[2],
        joinedAt: '2026-08-15T11:00:00.000Z',
      },
    ],
  },
  {
    id: 'g2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
    name: 'Wednesday Night League',
    description: 'Midweek 5-a-side under floodlights at National Stadium.',
    schedule: 'Every Wednesday, 7:00 PM',
    targetPlayers: 10,
    feePerPlayer: 3000,
    paymentType: PaymentType.MONTHLY,
    createdAt: '2026-08-18T10:00:00.000Z',
    memberships: [
      {
        id: 'm4d4d4d4-e5e5-4f6f-a7a7-b8b8c9c9d0d0',
        role: MemberRole.ORGANIZER,
        player: players[0],
        joinedAt: '2026-08-18T10:00:00.000Z',
      },
      {
        id: 'm5e5e5e5-f6f6-4a7a-b8b8-c9c9d0d0e1e1',
        role: MemberRole.PLAYER,
        player: players[3],
        joinedAt: '2026-08-20T17:00:00.000Z',
      },
    ],
  },
];

// ── Payments ──

export const payments: (IPayment & { player?: IPlayer })[] = [
  // Session 1 payments (completed session — all paid)
  {
    id: 'pay-1a2b3c4d-e5f6-4a7b-8c9d-000000000001',
    sessionId: 's1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    playerId: players[0].id,
    amount: 2000,
    status: PaymentStatus.PAID,
    paidAt: '2026-09-13T07:30:00.000Z',
    player: players[0],
  },
  {
    id: 'pay-1a2b3c4d-e5f6-4a7b-8c9d-000000000002',
    sessionId: 's1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    playerId: players[1].id,
    amount: 2000,
    status: PaymentStatus.PAID,
    paidAt: '2026-09-13T07:45:00.000Z',
    player: players[1],
  },
  {
    id: 'pay-1a2b3c4d-e5f6-4a7b-8c9d-000000000003',
    sessionId: 's1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    playerId: players[2].id,
    amount: 2000,
    status: PaymentStatus.WAIVED,
    player: players[2],
  },
  // Session 2 payments (upcoming session — mixed)
  {
    id: 'pay-2a2b3c4d-e5f6-4a7b-8c9d-000000000004',
    sessionId: 's2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
    playerId: players[0].id,
    amount: 2000,
    status: PaymentStatus.PAID,
    paidAt: '2026-09-26T10:00:00.000Z',
    player: players[0],
  },
  {
    id: 'pay-2a2b3c4d-e5f6-4a7b-8c9d-000000000005',
    sessionId: 's2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
    playerId: players[1].id,
    amount: 2000,
    status: PaymentStatus.PENDING,
    player: players[1],
  },
  // Session 3 payments (upcoming Wednesday — pending)
  {
    id: 'pay-3a2b3c4d-e5f6-4a7b-8c9d-000000000006',
    sessionId: 's3c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e',
    playerId: players[0].id,
    amount: 3000,
    status: PaymentStatus.PENDING,
    player: players[0],
  },
  {
    id: 'pay-3a2b3c4d-e5f6-4a7b-8c9d-000000000007',
    sessionId: 's3c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e',
    playerId: players[3].id,
    amount: 3000,
    status: PaymentStatus.PENDING,
    player: players[3],
  },
  // Session 4 — cancelled, one payment was already made
  {
    id: 'pay-4a2b3c4d-e5f6-4a7b-8c9d-000000000008',
    sessionId: 's4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f',
    playerId: players[1].id,
    amount: 3000,
    status: PaymentStatus.PAID,
    paidAt: '2026-09-08T19:00:00.000Z',
    player: players[1],
  },
];

// ── Helpers ──

function toGroup(g: IGroupWithMembers): IGroup {
  const { memberships: _, ...group } = g;
  return group;
}

// ── Sessions ──

export const sessions: ISessionWithDetails[] = [
  {
    id: 's1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    groupId: groups[0].id,
    date: '2026-09-13T07:00:00.000Z',
    targetAmount: 20000,
    collectedAmount: 4000,
    status: SessionStatus.COMPLETED,
    group: toGroup(groups[0]),
    payments: payments.filter(
      (p) => p.sessionId === 's1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'
    ),
  },
  {
    id: 's2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
    groupId: groups[0].id,
    date: '2026-10-04T07:00:00.000Z',
    targetAmount: 20000,
    collectedAmount: 2000,
    status: SessionStatus.UPCOMING,
    group: toGroup(groups[0]),
    payments: payments.filter(
      (p) => p.sessionId === 's2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d'
    ),
  },
  {
    id: 's3c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e',
    groupId: groups[1].id,
    date: '2026-10-07T19:00:00.000Z',
    targetAmount: 30000,
    collectedAmount: 0,
    status: SessionStatus.UPCOMING,
    group: toGroup(groups[1]),
    payments: payments.filter(
      (p) => p.sessionId === 's3c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e'
    ),
  },
  {
    id: 's4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f',
    groupId: groups[1].id,
    date: '2026-09-10T19:00:00.000Z',
    targetAmount: 30000,
    collectedAmount: 3000,
    status: SessionStatus.CANCELLED,
    group: toGroup(groups[1]),
    payments: payments.filter(
      (p) => p.sessionId === 's4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f'
    ),
  },
];
