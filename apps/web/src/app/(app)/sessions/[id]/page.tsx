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
  setRsvpForPlayer,
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
import { GameMenu } from '@/components/game/game-actions';
import { PlayerList, type PlayerAction } from '@/components/game/player-list';
import { EndGameSheet } from '@/components/game/end-game-sheet';
import { coveredByDues as coversByDues, gamePhase, gameTally } from '@/lib/game-player';
import { btnPrimary } from '@/components/buttons';

type Tab = 'players' | 'teams' | 'stars';
const TABS: Tab[] = ['players', 'teams', 'stars'];
const TAB_ICONS: Record<Tab, string> = {
  players: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  teams: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  stars: 'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
};

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

  const phase = session ? gamePhase(session, daysFromToday(session.date), session.group?.kickoffTime) : 'before';
  const before = phase === 'before' || phase === 'today';

  async function remind() {
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
      act(p, () => waivePayment(p.id), before ? `${first} plays free` : `${first} played free`);
    } else if (action === 'out') {
      act(p, () => setRsvpForPlayer(id, p.playerId, 'out'), `${first} is off this game`);
    } else {
      act(p, () => markUnpaid(p.id), before ? `${first} hasn’t paid yet` : `${first} is back to to pay`);
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
  const coveredByDues = coversByDues(session);
  const isGame = session.kind !== 'dues';
  const cancelled = phase === 'cancelled';
  const played = !before && !cancelled;
  const tally = gameTally(payments, coveredByDues, before);
  const gameLabel =
    session.kind === 'dues' && session.label
      ? `${session.label} dues`
      : gameDay(session.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <BackButton label="Back" />
        <GameMenu
          phase={phase}
          onEnd={() => setEnding(true)}
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

      <GameHero session={session} coveredByDues={coveredByDues} phase={phase} reminding={reminding} onRemind={remind} />

      {/* The one thing to do next, when there is one */}
      {isGame && phase === 'after' && (
        <button onClick={() => setEnding(true)} className={`${btnPrimary} w-full mt-4 animate-rise`}>
          End game · say who came
        </button>
      )}
      {isGame && phase === 'today' && tab !== 'teams' && (
        <button onClick={() => chooseTab('teams')} className={`${btnPrimary} w-full mt-4 animate-rise`}>
          Pick today’s teams
        </button>
      )}

      {/* Tabs: players / teams / stars */}
      {isGame && (
        <div className="sticky top-0 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 mt-4 mb-3 bg-chalk/95 backdrop-blur">
          <div className="grid grid-cols-3 gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-card" role="tablist" aria-label="This game">
            {([
              ['players', 'Players', TAB_ICONS.players, played && tally.toPay ? tally.toPay : null],
              ['teams', 'Teams', TAB_ICONS.teams, null],
              ['stars', 'Stars', TAB_ICONS.stars, null],
            ] as [Tab, string, string, number | null][]).map(([t, label, icon, badge]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => chooseTab(t)}
                className={`press flex items-center justify-center gap-1.5 h-11 rounded-xl text-[14px] font-bold transition-colors ${
                  tab === t ? 'bg-ink text-volt-300' : 'text-ink hover:bg-chalk'
                }`}
              >
                <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                {label}
                {badge !== null && (
                  <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-extrabold leading-5 tabular-nums ${tab === t ? 'bg-sun-400 text-ink' : 'bg-sun-400/30 text-amber-800'}`}>
                    {badge}
                    <span className="sr-only"> to pay</span>
                  </span>
                )}
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
              <LineupCard sessionId={id} />
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
              before={before}
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
