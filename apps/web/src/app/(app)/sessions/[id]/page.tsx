'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/back-button';
import { EmptyState } from '@/components/empty-state';
import { useToast } from '@/components/toast';
import {
  getSession,
  getGroup,
  getGroupOwed,
  getGroupTransfers,
  assignTransfer,
  markPaid,
  markUnpaid,
  markNoShow,
  markCame,
  waivePayment,
  bulkMarkPaid,
  deleteSession,
  updateSessionStatus,
  exportSessionPaymentsCsv,
  sendReminders,
  type BankTransfer,
  type OwedItem,
  type ISessionWithDetails,
} from '@/lib/api';
import { SessionStatus, type IPayment } from '@pitchaside/shared';
import { SessionVotingCard } from '@/components/ratings';
import { LineupCard } from '@/components/lineup-card';
import { TeamSheet } from '@/components/team-sheet';
import { HowPaidSheet } from '@/components/group/how-paid-sheet';
import { daysFromToday, gameDay } from '@/components/money-card';
import { GameHero } from '@/components/game/game-hero';
import { GameActions } from '@/components/game/game-actions';
import { PlayerList, type PlayerAction } from '@/components/game/player-list';
import { EndGameSheet } from '@/components/game/end-game-sheet';
import { gameTally } from '@/lib/game-player';

type Tab = 'players' | 'teams' | 'stars';
const TABS: Tab[] = ['players', 'teams', 'stars'];

/** Groups whose period dues cover their games. */
const PERIODIC = ['weekly', 'monthly', 'quarterly', 'annually'];

/** Today as YYYY-MM-DD in the browser's time zone. */
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const nameOfPayment = (p?: IPayment) => (p?.player ? `${p.player.firstName} ${p.player.lastName}` : 'Player');

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [session, setSession] = useState<ISessionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [ending, setEnding] = useState(false);
  // Long squads (30+) made this page endless: players, teams and stars each get a tab.
  const [tab, setTab] = useState<Tab | null>(null);
  // Money in the group account no one could put a name to: one may be a player's payment.
  const [unnamed, setUnnamed] = useState<BankTransfer[]>([]);
  // What everyone owes and has kept, so the sheet can say where any extra goes.
  const [owed, setOwed] = useState<OwedItem[]>([]);
  const [kept, setKept] = useState<Record<string, number>>({});
  const [howPaid, setHowPaid] = useState<string | null>(null);

  const fetchSession = useCallback(() => {
    return getSession(id)
      .then(setSession)
      .catch(() => router.push('/sessions'));
  }, [id, router]);

  useEffect(() => {
    fetchSession().finally(() => setLoading(false));
  }, [fetchSession]);

  const groupId = session?.groupId;
  const loadUnnamed = useCallback(() => {
    if (!groupId) return;
    getGroupTransfers(groupId)
      .then((ts) => setUnnamed(ts.filter((t) => t.status === 'unmatched')))
      // Treasurers without access, or offline: Mark paid just marks paid.
      .catch(() => setUnnamed([]));
    getGroupOwed(groupId).then(setOwed).catch(() => setOwed([]));
    getGroup(groupId)
      .then((g) => setKept(Object.fromEntries((g.memberships ?? []).map((m) => [m.player.id, Number(m.credit ?? 0)]))))
      .catch(() => setKept({}));
  }, [groupId]);
  useEffect(loadUnnamed, [loadUnnamed]);

  // Opening tab: ?tab= if given, else Teams on match day, else Players. (?tab=payments is the old name.)
  useEffect(() => {
    if (!session || tab) return;
    const asked = new URLSearchParams(window.location.search).get('tab');
    const wanted = asked === 'payments' ? 'players' : asked;
    setTab(
      TABS.includes(wanted as Tab)
        ? (wanted as Tab)
        : session.status === SessionStatus.UPCOMING && String(session.date).slice(0, 10) === localToday()
          ? 'teams'
          : 'players',
    );
    // From the home's "End game": straight into who came.
    if (new URLSearchParams(window.location.search).get('end') === '1' && session.status === SessionStatus.UPCOMING) setEnding(true);
  }, [session, tab]);

  function chooseTab(t: Tab) {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    window.history.replaceState(null, '', url);
  }

  /** Runs a change to one player, refreshes the game, and says what happened. */
  async function act(p: IPayment, run: () => Promise<unknown>, done: string) {
    setBusyId(p.id);
    try {
      await run();
      await fetchSession();
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That didn’t save. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  function onPlayerAction(p: IPayment, action: PlayerAction) {
    const first = nameOfPayment(p).split(' ')[0];
    if (action === 'paid') {
      // With money waiting for a name, ask whether it was one of those; otherwise just mark paid.
      if (unnamed.length) setHowPaid(p.id);
      else act(p, () => markPaid(p.id), `${first} marked paid`);
    } else if (action === 'no_show') {
      act(p, () => markNoShow(p.id), `${first} didn’t come: nothing to pay`);
    } else if (action === 'came') {
      act(p, () => markCame(p.id), `${first} came after all`);
    } else if (action === 'free') {
      act(p, () => waivePayment(p.id), `${first} played free`);
    } else {
      act(p, () => markUnpaid(p.id), `${first} is back to to pay`);
    }
  }

  async function payWithTransfer(paymentId: string, t: BankTransfer, done: string) {
    setBusyId(paymentId);
    try {
      await assignTransfer(t.id, paymentId);
      setHowPaid(null);
      await fetchSession();
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That didn’t save. Try again.');
    } finally {
      setBusyId(null);
      loadUnnamed();
    }
  }

  async function setStatus(status: 'upcoming' | 'completed' | 'cancelled', done: string) {
    try {
      await updateSessionStatus(id, status);
      await fetchSession();
      toast.success(done);
    } catch {
      toast.error('That didn’t save. Try again.');
    }
  }

  if (loading || !session) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-20" />
          <div className="h-52 bg-gray-100 rounded-[28px]" />
          <div className="h-12 bg-gray-100 rounded-2xl" />
          <div className="h-40 bg-gray-100 rounded-3xl" />
        </div>
      </div>
    );
  }

  const payments = session.payments || [];
  // Monthly-type groups: a game costs nothing extra; a player has paid for it when their dues
  // for that period are paid, and that's where they're collected.
  const coveredByDues = session.kind !== 'dues' && PERIODIC.includes(session.group?.paymentType ?? '');
  const isGame = session.kind !== 'dues';
  const days = daysFromToday(session.date);
  const ended = session.status === SessionStatus.COMPLETED;
  const cancelled = session.status === SessionStatus.CANCELLED;
  const played = ended || days < 0;
  const tally = gameTally(payments, coveredByDues);
  const gameLabel =
    session.kind === 'dues' && session.label
      ? `${session.label} dues`
      : gameDay(session.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <BackButton label="Games" />

      {howPaid && (() => {
        const p = payments.find((x) => x.id === howPaid);
        if (!p) return null;
        return (
          <HowPaidSheet
            member={{ playerId: p.playerId, name: nameOfPayment(p), credit: kept[p.playerId] ?? 0 }}
            paymentId={p.id}
            owed={owed}
            due={Number(p.amount)}
            game={gameLabel}
            transfers={unnamed}
            busy={busyId === p.id}
            onUseTransfer={(t, outcome) => payWithTransfer(p.id, t, outcome)}
            onOtherWay={() => {
              setHowPaid(null);
              act(p, () => markPaid(p.id), `${nameOfPayment(p).split(' ')[0]} marked paid`);
            }}
            onClose={() => setHowPaid(null)}
          />
        );
      })()}

      {ending && (
        <EndGameSheet
          session={session}
          coveredByDues={coveredByDues}
          onClose={() => setEnding(false)}
          onEnded={(s) => {
            setEnding(false);
            setSession(s);
            fetchSession();
          }}
        />
      )}

      <div className="mt-3">
        <GameHero session={session} coveredByDues={coveredByDues} played={played} />
      </div>

      <div className="mt-4">
        <GameActions
          canEnd={isGame && days <= 0}
          ended={ended}
          cancelled={cancelled}
          toPay={tally.toPay}
          reminding={reminding}
          onEnd={() => setEnding(true)}
          onRemind={async () => {
            setReminding(true);
            try {
              const result = await sendReminders(id);
              toast.success(
                result.missed
                  ? `Reminder sent to ${result.sent}. ${result.missed} haven’t turned on notifications yet.`
                  : `Reminder sent to ${result.sent} player${result.sent === 1 ? '' : 's'}`,
              );
            } catch {
              toast.error('The reminder didn’t send. Try again.');
            } finally {
              setReminding(false);
            }
          }}
          onReopen={() => setStatus('upcoming', cancelled ? 'Game is back on' : 'Game reopened')}
          onDownload={() => exportSessionPaymentsCsv(id).catch(() => toast.error('The download didn’t start. Try again.'))}
          onCancel={() => setStatus('cancelled', 'Game cancelled')}
          onDelete={async () => {
            try {
              await deleteSession(id);
              toast.success('Game deleted');
              router.push('/sessions');
            } catch {
              toast.error('The game wasn’t deleted. Try again.');
            }
          }}
        />
      </div>

      {/* Tabs: players / teams / stars */}
      {isGame && (
        <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 mt-5 mb-3 bg-chalk/95 backdrop-blur">
          <div className="flex p-1 bg-white border border-gray-200 rounded-2xl" role="tablist">
            {([
              ['players', 'Players', tally.toPay ? `${tally.toPay} to pay` : null],
              ['teams', 'Teams', null],
              ['stars', 'Stars', null],
            ] as [Tab, string, string | null][]).map(([t, label, note]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => chooseTab(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${tab === t ? 'bg-ink text-volt-300' : 'text-gray-500 hover:text-ink'}`}
              >
                {label}
                {note && <span className={`block text-[11px] font-semibold ${tab === t ? 'text-white/60' : 'text-amber-700'}`}>{note}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {isGame && tab === 'teams' && (
        <>
          {session.status === SessionStatus.UPCOMING && <TeamSheet sessionId={id} onChange={fetchSession} />}
          {!cancelled && (
            <div id="lineup" className="scroll-mt-20">
              <LineupCard sessionId={id} matchDay={String(session.date).slice(0, 10) <= localToday()} />
            </div>
          )}
        </>
      )}

      {isGame && tab === 'stars' && !cancelled && <SessionVotingCard sessionId={id} groupName={session.group?.name ?? 'Game'} />}

      {(!isGame || tab === 'players') &&
        (payments.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={played ? 'No one played' : 'No one’s in yet'}
            description={
              session.group?.requireRsvp
                ? 'Players say they’re in from the game link. Each player who’s in pays once they’ve played.'
                : 'Everyone in the group is added when the game is made. Add players to the group first.'
            }
          />
        ) : (
          <>
            {coveredByDues && (
              <p className="mb-3 text-[13px] leading-snug text-gray-600">
                This group pays {session.group?.paymentType} dues, so the game costs nothing extra.{' '}
                <Link href={`/groups/${session.groupId}?tab=games`} className="font-bold text-pitch-700 hover:text-ink">
                  Collect dues on the group
                </Link>
              </p>
            )}
            <PlayerList
              payments={payments}
              coveredByDues={coveredByDues}
              busyId={busyId}
              onAction={onPlayerAction}
              onBulkPaid={async (ids) => {
                try {
                  await bulkMarkPaid(ids);
                  await fetchSession();
                  toast.success(`${ids.length} player${ids.length === 1 ? '' : 's'} marked paid`);
                } catch {
                  toast.error('That didn’t save. Try again.');
                }
              }}
            />
          </>
        ))}
    </div>
  );
}
