import { CLAIM_WINDOW_MS, claimSettledBy, couldPair } from './claims';

const t0 = new Date('2026-10-09T09:00:00Z');
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
const claim = (id: string, playerId: string, amount: number, minutes = 0) => ({ id, playerId, amount, createdAt: at(minutes) });
const transfer = (id: string, amount: number, minutes = 0) => ({ id, amount, receivedAt: at(minutes) });

describe('couldPair', () => {
  it('allows rounding on the amount but not a different amount', () => {
    expect(couldPair(claim('c', 'p', 3000), transfer('t', 3025))).toBe(true);
    expect(couldPair(claim('c', 'p', 3000), transfer('t', 1500))).toBe(false);
  });

  it('only pairs within the window either side', () => {
    expect(couldPair(claim('c', 'p', 3000, 0), transfer('t', 3000, -30))).toBe(true);
    expect(couldPair(claim('c', 'p', 3000, 0), transfer('t', 3000, CLAIM_WINDOW_MS / 60_000 + 1))).toBe(false);
  });
});

describe('claimSettledBy (a transfer was matched to the player another way)', () => {
  it("closes that player's claim that fits the transfer", () => {
    const mark = claim('c1', 'mark', 1500, 10);
    expect(claimSettledBy(transfer('t1', 1525), 'mark', [mark, claim('c2', 'ada', 1500, 10)])?.id).toBe('c1');
  });

  it("leaves other players' claims alone", () => {
    expect(claimSettledBy(transfer('t1', 1525), 'mark', [claim('c2', 'ada', 1500)])).toBeNull();
  });

  it('closes only one claim per transfer, the earliest', () => {
    const first = claim('c1', 'mark', 1500, 5);
    const second = claim('c2', 'mark', 1500, 30);
    expect(claimSettledBy(transfer('t1', 1500), 'mark', [second, first])?.id).toBe('c1');
  });

  it("doesn't close a claim for a different amount or a day away", () => {
    expect(claimSettledBy(transfer('t1', 3000), 'mark', [claim('c1', 'mark', 1500)])).toBeNull();
    expect(claimSettledBy(transfer('t1', 1500, CLAIM_WINDOW_MS / 60_000 + 5), 'mark', [claim('c1', 'mark', 1500)])).toBeNull();
  });
});
