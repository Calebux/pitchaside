export enum PaymentType {
  PER_SESSION = 'per_session',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

export enum SessionKind {
  GAME = 'game',
  DUES = 'dues',
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

/** What players in a group can see of the kitty: nothing, totals, or totals plus who's paid. */
export type ContributionsVisibility = 'private' | 'totals' | 'names';
export const CONTRIBUTIONS_VISIBILITY: ContributionsVisibility[] = ['private', 'totals', 'names'];

export interface IGroup {
  id: string;
  name: string;
  description?: string;
  location?: string;
  schedule?: string;
  targetPlayers: number;
  feePerPlayer: number;
  paymentType: PaymentType;
  requireRsvp?: boolean;
  kickoffTime?: string | null;
  contributionsVisibility?: ContributionsVisibility;
  /** What each side wears and is called; null for the default colours. */
  bibs?: Bibs | null;
  inviteCode?: string;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  createdAt: string;
}

export interface IPlayer {
  id: string;
  firstName: string;
  lastName: string;
  /** What they're called on the pitch; shown on team sheets. */
  nickname?: string | null;
  /** Their photo's key (served at /api/photos/:key); null for none. */
  photoKey?: string | null;
  /** Optional contact number. Players sign in with their email. */
  phone?: string | null;
  email?: string | null;
  /** Level the organiser gave them; seeds their skill rating (null = average). */
  level?: PlayerLevel | null;
  createdAt: string;
}

/** How good a player is before they've played here: seeds their skill rating for team balancing. */
export type PlayerLevel = 'beginner' | 'average' | 'good' | 'strong';

export interface ISession {
  id: string;
  groupId: string;
  date: string;
  targetAmount: number;
  collectedAmount: number;
  status: SessionStatus;
  kind?: SessionKind;
  label?: string;
  /** "HH:mm" set for this game; null means the group's kick-off time. */
  kickoffTime?: string | null;
  /** Coloured sides on match day (2–6). */
  teamCount?: number;
  payments?: IPayment[];
  /** When the vote opened (the game was ended); null until then. */
  voteOpensAt?: string | null;
  /** Set when everyone who came had voted: the vote closed early, then. */
  voteClosedAt?: string | null;
}

export interface IPayment {
  id: string;
  sessionId: string;
  playerId: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
  markedBy?: string;
  /** 'dues' on a game's ₦0 entry in a group whose period dues cover games. */
  source?: 'manual' | 'transfer' | 'dues' | null;
  /** On games: paid for this game — their own due, or the period's dues that cover it. */
  gamePaid?: 'paid' | 'unpaid' | 'waived';
  /** Already sent towards this due by transfer (a part payment); only on a player's oldest unpaid due. */
  paidSoFar?: number;
  /** Whether they turned up: not set until the game is ended (counts as came), 'came', or 'no_show'. */
  attendance?: 'came' | 'no_show' | null;
  player?: IPlayer;
}

// ── Audit ──

export enum AuditAction {
  PAYMENT_MARKED_PAID = 'payment_marked_paid',
  PAYMENT_WAIVED = 'payment_waived',
  PAYMENT_BULK_MARKED_PAID = 'payment_bulk_marked_paid',
  SESSION_CREATED = 'session_created',
  SESSION_STATUS_CHANGED = 'session_status_changed',
  GROUP_CREATED = 'group_created',
  PLAYER_CREATED = 'player_created',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
}

// ── Recurring Sessions ──

export enum RecurrenceType {
  NONE = 'none',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

// ── Auth & Multi-tenancy ──

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  MEMBER = 'member',
  TREASURER = 'treasurer',
}

export interface IOrganization {
  id: string;
  name: string;
  inviteCode?: string;
  createdAt: string;
}

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  bvn?: string | null;
  role: UserRole;
  organizationId: string;
  organization?: IOrganization;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  createdAt: string;
}

export interface IAuthResponse {
  accessToken: string;
  user: IUser;
}

// ── Payouts ──

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface IOutgoingTransfer {
  id: string;
  groupId: string;
  amount: number;
  fee: number;
  beneficiaryAccount: string;
  beneficiaryName: string;
  beneficiaryBankCode: string;
  beneficiaryBankName: string;
  narration?: string;
  status: PayoutStatus;
  providerReference?: string;
  errorMessage?: string;
  initiatedById?: string;
  initiatedBy?: { firstName: string; lastName: string };
  createdAt: string;
  completedAt?: string;
}

export interface INigerianBank {
  code: string;
  name: string;
}

export interface IGroupBalance {
  totalIn: number;
  totalOut: number;
  available: number;
}

// ── Competitions ──

export enum CompetitionFormat {
  KNOCKOUT = 'knockout',
  LEAGUE = 'league',
}

export enum CompetitionScope {
  NATIONWIDE = 'nationwide',
  STATE = 'state',
  CITY = 'city',
}

export enum CompetitionStatus {
  DRAFT = 'draft',
  REGISTRATION_OPEN = 'registration_open',
  REGISTRATION_CLOSED = 'registration_closed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CompetitionVisibility {
  PUBLIC = 'public',
  INVITE_ONLY = 'invite_only',
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  WALKOVER = 'walkover',
}

export enum TeamRegistrationStatus {
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  WITHDRAWN = 'withdrawn',
  DISQUALIFIED = 'disqualified',
}

export interface ICompetition {
  id: string;
  name: string;
  description?: string;
  format: CompetitionFormat;
  scope: CompetitionScope;
  state?: string;
  city?: string;
  visibility: CompetitionVisibility;
  status: CompetitionStatus;
  entryFee: number;
  maxTeams: number;
  minPlayersPerTeam: number;
  maxPlayersPerTeam: number;
  registrationDeadline?: string;
  startDate?: string;
  endDate?: string;
  rules?: string;
  inviteCode?: string;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  createdByUserId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICompetitionTeam {
  id: string;
  competitionId: string;
  name: string;
  captainName: string;
  captainPhone: string;
  captainEmail?: string;
  registrationStatus: TeamRegistrationStatus;
  paidAt?: string;
  seed?: number;
  paymentRef?: string;
  createdAt: string;
}

export interface ICompetitionMatch {
  id: string;
  competitionId: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeam?: ICompetitionTeam;
  awayTeam?: ICompetitionTeam;
  round: number;
  matchNumber: number;
  scheduledDate?: string;
  scheduledTime?: string;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
  homePenalties?: number;
  awayPenalties?: number;
  winnerId?: string;
  status: MatchStatus;
  notes?: string;
  createdAt: string;
}

export interface ICompetitionStanding {
  position: number;
  teamId: string;
  team: ICompetitionTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

// ── Bibs: the colours a group's sides wear, and their names ──

/** Bib colours an organiser can pick. `ink`: dark text reads on it (else white). */
export const BIB_COLOURS = {
  orange: { label: 'Orange', hex: '#ff6a3d', ink: true },
  yellow: { label: 'Yellow', hex: '#ffc93c', ink: true },
  blue: { label: 'Blue', hex: '#3b82f6', ink: false },
  white: { label: 'White', hex: '#ffffff', ink: true },
  green: { label: 'Green', hex: '#2f8f48', ink: false },
  red: { label: 'Red', hex: '#e5484d', ink: false },
  black: { label: 'Black', hex: '#1b201d', ink: false },
  sky: { label: 'Sky blue', hex: '#62c4f0', ink: true },
  navy: { label: 'Navy', hex: '#1f3a8a', ink: false },
  maroon: { label: 'Maroon', hex: '#7c1f2b', ink: false },
  pink: { label: 'Pink', hex: '#f472b6', ink: true },
  purple: { label: 'Purple', hex: '#7c4dde', ink: false },
  grey: { label: 'Grey', hex: '#9aa19c', ink: true },
  lime: { label: 'Lime', hex: '#c8f03c', ink: true },
} as const;
export type BibColour = keyof typeof BIB_COLOURS;
export const BIB_COLOUR_KEYS = Object.keys(BIB_COLOURS) as BibColour[];

/** One side's bib: its colour, and a name the organiser gave it ("Red Devils"), if any. */
export interface TeamBib {
  colour: BibColour;
  name?: string | null;
}
export type BibSides = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
/** A group's (or one game's) bibs, side by side. Sides left out wear the default colour. */
export type Bibs = Partial<Record<BibSides, TeamBib>>;

/** What each side wears when nobody has set bibs. */
export const DEFAULT_BIBS: Record<BibSides, TeamBib> = {
  A: { colour: 'orange' },
  B: { colour: 'yellow' },
  C: { colour: 'blue' },
  D: { colour: 'white' },
  E: { colour: 'green' },
  F: { colour: 'red' },
};

/** Longest team name an organiser can give a side. */
export const TEAM_NAME_MAX = 20;
