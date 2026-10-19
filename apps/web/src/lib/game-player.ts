import { PaymentStatus, type IPayment } from '@pitchaside/shared';
import { formatCurrency } from './api';

/** Groups whose weekly, monthly (…) dues cover their games: a game costs nothing extra. */
const PERIODIC = ['weekly', 'monthly', 'quarterly', 'annually'];

export function coveredByDues(game: { kind?: string; group?: { paymentType?: string } | null }, paymentType = game.group?.paymentType) {
  return game.kind !== 'dues' && PERIODIC.includes(paymentType ?? '');
}

/**
 * Where one player stands for one game, in the words every screen uses. Attendance comes first
 * (a player who didn't come owes nothing), then money: paid by transfer, marked paid by hand,
 * played free, or still to pay. In groups whose monthly (weekly…) dues cover games, the game
 * itself costs nothing and the question is whether their dues are paid.
 */
export type PlayerStateKey = 'to_pay' | 'paid' | 'free' | 'no_show' | 'dues_paid' | 'dues_unpaid';

export interface PlayerState {
  key: PlayerStateKey;
  /** Short line under their name: "₦1,500 to pay", "Paid by transfer", "Didn't come". */
  label: string;
  /** Still to collect from them for this game. */
  owes: boolean;
}

export function playerState(p: IPayment, coveredByDues: boolean): PlayerState {
  if (p.attendance === 'no_show') return { key: 'no_show', label: 'Didn’t come', owes: false };
  if (coveredByDues) {
    return p.gamePaid === 'paid'
      ? { key: 'dues_paid', label: 'Dues paid', owes: false }
      : p.gamePaid === 'waived'
        ? { key: 'free', label: 'Played free', owes: false }
        : { key: 'dues_unpaid', label: 'Dues not paid yet', owes: false };
  }
  if (p.status === PaymentStatus.PAID) {
    // Marked paid by hand: we can't tell cash from anything else, so we don't say cash.
    return { key: 'paid', label: p.source === 'transfer' ? 'Paid by transfer' : 'Marked paid', owes: false };
  }
  if (p.status === PaymentStatus.WAIVED) return { key: 'free', label: 'Played free', owes: false };
  return { key: 'to_pay', label: `${formatCurrency(Number(p.amount))} to pay`, owes: true };
}

/** The game's money in one place: who's in (no-shows aside), who's paid, who still owes. */
export function gameTally(payments: IPayment[], coveredByDues: boolean) {
  const states = payments.map((p) => ({ p, s: playerState(p, coveredByDues) }));
  const playing = states.filter(({ s }) => s.key !== 'no_show');
  const paid = states.filter(({ s }) => s.key === 'paid' || s.key === 'dues_paid');
  const toPay = states.filter(({ s }) => s.owes);
  const noShows = states.filter(({ s }) => s.key === 'no_show');
  const sum = (xs: { p: IPayment }[]) => xs.reduce((n, { p }) => n + Number(p.amount), 0);
  return {
    states,
    playing: playing.length,
    paid: paid.length,
    paidAmount: sum(paid.filter(({ s }) => s.key === 'paid')),
    toPay: toPay.length,
    toPayAmount: sum(toPay),
    noShows: noShows.length,
  };
}
