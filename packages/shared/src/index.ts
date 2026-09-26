export enum PaymentType {
  PER_SESSION = 'per_session',
  MONTHLY = 'monthly',
}

export enum MemberRole {
  ORGANIZER = 'organizer',
  PLAYER = 'player',
}

export enum SessionStatus {
  UPCOMING = 'upcoming',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PAID = 'paid',
  PENDING = 'pending',
  WAIVED = 'waived',
}

export interface IGroup {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  targetPlayers: number;
  feePerPlayer: number;
  paymentType: PaymentType;
  createdAt: string;
}

export interface IPlayer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  createdAt: string;
}

export interface ISession {
  id: string;
  groupId: string;
  date: string;
  targetAmount: number;
  collectedAmount: number;
  status: SessionStatus;
  payments?: IPayment[];
}

export interface IPayment {
  id: string;
  sessionId: string;
  playerId: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
  markedBy?: string;
  player?: IPlayer;
}
