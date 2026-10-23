'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Bibs, KeeperPref, MatchPlan } from '@pitchaside/shared';
import { Sheet } from '@/components/sheet';
import { SheetTitle } from '@/components/home/sheet-title';
import { Avatar } from '@/components/ratings';
import { BallSpinner } from '@/components/skeleton';
import { LiveDot, buzz, stagger } from '@/components/motion';
import { Swatch } from '@/components/game/teams-step';
import { BibShirt } from '@/components/bib-shirt';
import { FilterBar, FilterMenu } from '@/components/filter-menu';
import { teamName } from '@/lib/teams';
import type { TeamKey } from '@/lib/api';
import type { WsState } from '@/lib/winner-stays';
import { clipSpells, clockAt, spellAt, type Day, type Fixture, type LiveDay, type Side, type Spell } from '@/lib/match-plan';

/** Someone in the plan, as every view shows them. */
export interface PlanPerson {
  id: string;
  /** Nickname, else first name. */
  name: string;
  /** For their face's initials. */
  full: string;
  photoKey?: string | null;
  keeper?: KeeperPref;
  me?: boolean;
}

export interface PlanLook {
  captains: Partial<Record<TeamKey, string>>;
  bibs?: Bibs;
  kickoff?: string | null;
}

/** "Blue" with its colour beside it. */
function SideName({ t, look, className = '' }: { t: Side; look: PlanLook; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <Swatch team={t} bibs={look.bibs} className="w-3 h-3 rounded-sm" />
      <span className="truncate">{teamName(t, look.captains, look.bibs)}</span>
    </span>
  );
}

const when = (look: PlanLook, minutes: number) => clockAt(look.kickoff, minutes) ?? `${Math.round(minutes)} min in`;

/** "Ada, Bisi and Chidi". */
function list(names: string[]) {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The spell a side is in now and the one after it, for the game on now. */
function sideNow(day: Day, side: Side, live: LiveDay) {
  if (!live.playing || live.elapsed == null) return null;
  const g = day.rotas[side]?.games.find((x) => x.fixture.n === live.playing!.n);
  if (!g) return null;
  return spellAt(g.spells, live.elapsed);
}

/** "Bisi on for Chidi. Dayo in goal." What changes at a swap. */
export function swapWords(before: Spell | undefined, after: Spell, nameOf: (id: string) => string) {
  const on = after.on.filter((id) => !before || before.off.includes(id));
  const off = after.off.filter((id) => !before || !before.off.includes(id));
  const parts: string[] = [];
  if (before && on.length) parts.push(`${list(on.map(nameOf))} on${off.length ? `, ${list(off.map(nameOf))} off` : ''}.`);
  if (after.keeper && after.keeper !== before?.keeper) parts.push(`${nameOf(after.keeper)} in goal.`);
  return parts.join(' ') || 'No change.';
}

/** The rule for the game on now, as a tag and one short line. */
export function WsRule({ ws, plan, center = false }: { ws: WsState; plan: MatchPlan; center?: boolean }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <span className="inline-flex items-center gap-1.5 min-h-7 px-2.5 rounded-full bg-ink text-volt-300 text-[12px] font-extrabold tabular-nums">
        {ws.firstRound ? `First round · ${ws.limit} min` : `First to concede ${plan.firstTo ?? 2} · or ${ws.limit} min`}
      </span>
      <p className={`mt-1.5 text-[12px] leading-snug text-gray-500 ${center ? 'text-balance' : ''}`}>
        {ws.firstRound ? 'Winner stays, loser off, whatever the score. Level: both off.' : 'At the whistle the team ahead stays. Level: both off.'}
      </p>
    </div>
  );
}

/**
 * Who's waiting, least played first (the order the app brings them on), each with a bar of the
 * minutes played so far against the most anyone has played: fairness at a glance.
 */
export function WsLine({ ws, look }: { ws: WsState; look: PlanLook }) {
  if (!ws.line.length) return null;
  const most = Math.max(1, ...Object.values(ws.minutes));
  const line = [...ws.line].sort((a, b) => ws.minutes[a] - ws.minutes[b]);
  return (
    <div>
      <p className="flex items-baseline justify-between gap-2 text-[12px] font-bold text-gray-500">
        <span>In line</span>
        <span className="font-semibold">Minutes played</span>
      </p>
      <ol className="mt-1.5 space-y-1.5">
        {line.map((t, i) => (
          <li key={t} className="grid grid-cols-[1.25rem_minmax(0,1fr)_5rem_2.25rem] items-center gap-2 min-h-8 animate-rise" style={stagger(i, 30, 0)}>
            <span className="text-[12px] font-extrabold text-gray-400 tabular-nums">{i + 1}</span>
            <SideName t={t} look={look} className="text-[14px] font-bold text-ink" />
            <span className="h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden>
              <span className="block h-full rounded-full bg-pitch-600 motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${(ws.minutes[t] / most) * 100}%` }} />
            </span>
            <span className="text-right text-[13px] font-bold text-ink tabular-nums">{Math.round(ws.minutes[t])}′</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] leading-snug text-gray-500">Picked when the score is saved: least played comes on first.</p>
    </div>
  );
}

/** The two sides on, side by side in their bibs, with a side one win from going off marked. */
function WsMatchup({ ws, plan, look, a, b }: { ws: WsState; plan: MatchPlan; look: PlanLook; a: Side; b: Side }) {
  const run = (t: Side) => plan.twoAndOff !== false && (ws.streak[t] ?? 0) >= 1;
  const side = (t: Side) => (
    <div className="min-w-0 flex flex-col items-center text-center gap-1.5">
      <BibShirt team={t} bibs={look.bibs} className="w-12 h-12" />
      <span className="max-w-full font-display text-[17px] leading-tight font-extrabold text-ink line-clamp-2 break-words">{teamName(t, look.captains, look.bibs)}</span>
      {run(t) ? (
        <span className="inline-flex items-center min-h-6 px-2 rounded-full bg-volt-300 text-[11px] font-extrabold text-ink whitespace-nowrap">1 more win: off</span>
      ) : (
        // Keeps both names level when only the other side has the tag.
        (run(a) || run(b)) && <span className="min-h-6" aria-hidden />
      )}
    </div>
  );
  return (
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
      {side(a)}
      <span className="pt-3.5 font-display text-[15px] font-extrabold text-gray-400" aria-hidden>
        v
      </span>
      {side(b)}
    </div>
  );
}

/**
 * The plan while the day is on, for the organiser and the captains: the game on now and the
 * next, a plain line when running late, and when a game's clock runs, each side's keeper and
 * who sits out, counting down to the next swap. At each swap this phone buzzes and says who
 * comes on.
 */
export function DayPlanLive({
  day,
  plan,
  live,
  gamesDone,
  look,
  people,
  myTeam,
  clockMinutes,
  onSetClock,
  onOpen,
  ws,
}: {
  day: Day;
  plan: MatchPlan;
  /** Winner stays: who's on, who's waiting, the rules for the game on now. */
  ws?: WsState;
  live: LiveDay;
  gamesDone: number;
  look: PlanLook;
  people: Map<string, PlanPerson>;
  /** A captain's own side comes first. */
  myTeam?: TeamKey | null;
  /** The timer's length now, to offer the next game's when it's different. */
  clockMinutes: number | null;
  /** Organiser only: set the clock for the next game. */
  onSetClock?: (minutes: number) => Promise<void>;
  onOpen: () => void;
}) {
  const nameOf = (id: string) => people.get(id)?.name ?? 'Someone';
  const total = gamesDone + (live.playing ? 1 : 0) + live.ahead.games.length;
  const next = live.ahead.games[0] ?? null;
  const upNow = live.playing ?? next;
  const [setting, setSetting] = useState(false);

  // At each swap: a buzz, and the change said in words for a while.
  const [swap, setSwap] = useState<{ key: string; text: string } | null>(null);
  const seen = useRef<string | null>(null);
  const sides = live.playing ? ([live.playing.teamA, live.playing.teamB] as Side[]) : [];
  if (myTeam && sides[1] === myTeam) sides.reverse();
  const now = sides.map((t) => ({ t, at: sideNow(day, t, live) }));
  const key = live.playing && now[0]?.at ? `${live.playing.n}-${now.map((x) => x.at?.index ?? 0).join('-')}` : null;
  useEffect(() => {
    if (!key) return;
    if (seen.current && seen.current !== key && seen.current.split('-')[0] === key.split('-')[0]) {
      const text = now
        .filter((x) => x.at && x.at.index > 0)
        .map((x) => {
          const g = day.rotas[x.t]!.games.find((y) => y.fixture.n === live.playing!.n)!;
          return `${teamName(x.t, look.captains, look.bibs)}: ${swapWords(g.spells[x.at!.index - 1], x.at!.spell, nameOf)}`;
        })
        .join(' ');
      if (text) {
        buzz([300, 120, 300]);
        setSwap({ key, text });
      }
    }
    seen.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!swap) return;
    const id = window.setTimeout(() => setSwap(null), 30_000);
    return () => window.clearTimeout(id);
  }, [swap]);

  if (!upNow) {
    return (
      <section aria-label="Day plan" className="rounded-3xl bg-white border border-gray-200 p-4">
        <p className="text-[12px] font-bold text-gray-500">Day plan</p>
        <p className="mt-0.5 text-[15px] font-bold text-ink">
          {!ws && gamesDone >= day.fixtures.length ? 'Every game in the plan is played.' : 'Time’s up on the booking.'}
        </p>
        <button onClick={onOpen} className="press mt-2 min-h-11 px-1 text-[14px] font-bold text-pitch-700">
          See the whole plan
        </button>
      </section>
    );
  }

  const lastChanged = live.ahead.lastMinutes;
  const nextLen = ws ? ws.limit : (next?.minutes ?? null);
  const offerClock = !!onSetClock && !live.playing && nextLen != null && clockMinutes != null && nextLen !== clockMinutes;

  const swapsPanel = (
    <>
      {/* Each side's keeper and who sits out, while the clock runs */}
      {plan.swapMinutes > 0 && live.playing && now.some((x) => x.at) && (
        <div className="border-t border-gray-100 bg-chalk/60 px-4 py-3">
          {swap && (
            <p className="mb-2.5 rounded-2xl bg-volt-300 px-3 py-2.5 text-[14px] leading-snug font-bold text-ink animate-pop" role="status">
              🔁 Swap now. {swap.text}
            </p>
          )}
          <ul className="space-y-2">
            {now.map(({ t, at }) =>
              at ? (
                <li key={t} className="rounded-2xl bg-white border border-gray-100 px-3 py-2.5">
                  <p className="flex items-center justify-between gap-2 text-[13px] font-extrabold text-ink">
                    <SideName t={t} look={look} />
                    {myTeam === t && <span className="shrink-0 text-[11px] font-bold text-gray-500">Your team</span>}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-gray-700">
                    <span aria-hidden>🧤 </span>
                    <b className="text-ink">In goal:</b> {at.spell.keeper ? nameOf(at.spell.keeper) : 'Anyone'}
                    {at.spell.off.length > 0 && (
                      <>
                        <br />
                        <b className="text-ink">Sitting out:</b> {list(at.spell.off.map(nameOf))}
                      </>
                    )}
                  </p>
                </li>
              ) : null,
            )}
          </ul>
          <NextSwap live={live} at={now[0]?.at ?? null} />
        </div>
      )}
    </>
  );

  const clockButton = offerClock && (
    <button
      onClick={async () => {
        setSetting(true);
        try {
          await onSetClock!(nextLen!);
        } finally {
          setSetting(false);
        }
      }}
      disabled={setting}
      className="press mt-3 w-full min-h-11 rounded-2xl bg-white border border-gray-300 text-[14px] font-bold text-ink hover:border-ink inline-flex items-center justify-center gap-2"
    >
      {setting && <BallSpinner className="w-4 h-4" />}
      Set the timer to {nextLen} min for this game
    </button>
  );

  if (ws) {
    return (
      <section aria-label="Day plan" className="rounded-3xl bg-white border border-gray-200 shadow-card overflow-hidden">
        <div className="px-4 pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-gray-500 tabular-nums">
              {live.playing ? (
                <span className="inline-flex items-center gap-1.5">
                  <LiveDot /> Game {upNow.n + 1} · on now
                </span>
              ) : (
                `Game ${upNow.n + 1} · up next`
              )}
            </p>
            <button onClick={onOpen} className="press shrink-0 -my-2 -mr-2 min-h-11 px-2 rounded-xl text-[13px] font-bold text-pitch-700 hover:bg-chalk">
              Whole plan
            </button>
          </div>
          <WsMatchup ws={ws} plan={plan} look={look} a={upNow.teamA} b={upNow.teamB} />
          <div className="mt-3">
            <WsRule ws={ws} plan={plan} center />
          </div>
          {clockButton}
        </div>
        {ws.line.length > 0 && (
          <div className="border-t border-gray-100 bg-chalk/50 px-4 py-3">
            <WsLine ws={ws} look={look} />
          </div>
        )}
        {swapsPanel}
      </section>
    );
  }

  return (
    <section aria-label="Day plan" className="rounded-3xl bg-white border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold text-gray-500 tabular-nums">
            {live.playing ? (
              <span className="inline-flex items-center gap-1.5">
                <LiveDot /> Game {live.playing.n + 1}
                {ws ? '' : ` of ${total}`} · on now
              </span>
            ) : ws ? (
              `Game ${upNow.n + 1} · up next`
            ) : (
              `Game ${upNow.n + 1} of ${total} · up next${look.kickoff ? ` · ${when(look, upNow.start)}` : ''}`
            )}
          </p>
          <button onClick={onOpen} className="press shrink-0 -my-2 min-h-11 px-2 rounded-xl text-[13px] font-bold text-pitch-700 hover:bg-chalk">
            Whole plan
          </button>
        </div>
        <p className="mt-1 flex items-center gap-2 font-display text-[20px] leading-tight font-extrabold text-ink">
          <SideName t={upNow.teamA} look={look} />
          <span className="shrink-0 text-gray-400 text-[15px]">v</span>
          <SideName t={upNow.teamB} look={look} />
        </p>
        {!ws && live.playing && next && (
          <p className="mt-1 text-[13px] text-gray-600 flex items-center gap-1.5 min-w-0">
            <span className="shrink-0">Next{look.kickoff ? ` at ${when(look, next.start)}` : ''}:</span>
            <SideName t={next.teamA} look={look} className="font-bold text-ink" />
            <span className="shrink-0">v</span>
            <SideName t={next.teamB} look={look} className="font-bold text-ink" />
          </p>
        )}

        {!ws && live.ahead.late > 0 && (
          <p className="mt-3 rounded-2xl bg-kit-500/10 border border-kit-500/30 px-3 py-2.5 text-[13px] leading-snug text-ink" role="status">
            <b>Running {live.ahead.late} min late.</b>{' '}
            {live.ahead.dropped > 0
              ? `The last ${live.ahead.dropped === 1 ? 'game is' : `${live.ahead.dropped} games are`} off so you finish on time${lastChanged ? `, and the game before is ${lastChanged} min` : ''}.`
              : lastChanged
                ? `The last game is now ${lastChanged} min so you finish on time.`
                : 'You still finish on time.'}
          </p>
        )}
        {clockButton}
      </div>

      {swapsPanel}
    </section>
  );
}

/** "Next swap in 2:13", ticking. */
function NextSwap({ live, at }: { live: LiveDay; at: ReturnType<typeof spellAt> | null }) {
  if (!at || at.nextAt == null || live.elapsed == null) {
    return <p className="mt-2 text-[12px] text-gray-500">No more swaps in this game.</p>;
  }
  const left = Math.max(0, Math.ceil((at.nextAt - live.elapsed) * 60));
  return (
    <p className="mt-2 text-[12px] font-bold text-gray-600 tabular-nums" role="timer">
      Next swap in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}. This phone buzzes when it’s time.
    </p>
  );
}

/**
 * The whole plan in a sheet: every game in order with its time (moved on when running late, the
 * score once saved), and per team who's in goal and who sits out in each spell, with each
 * player's minutes. The organiser (any team) and captains (their own) can mark someone as gone
 * early; the rest share their time.
 */
export function WholePlanSheet({
  day,
  plan,
  live,
  gamesDone,
  results,
  look,
  people,
  myTeam,
  canAway,
  onAway,
  onEdit,
  onClose,
  ws,
}: {
  day: Day;
  plan: MatchPlan;
  /** Winner stays: shows who's waiting, and the rounds by name. */
  ws?: WsState;
  live: LiveDay | null;
  gamesDone: number;
  /** Saved scores, in order. */
  results: { teamA: TeamKey; teamB: TeamKey; scoreA: number; scoreB: number }[];
  look: PlanLook;
  people: Map<string, PlanPerson>;
  myTeam?: TeamKey | null;
  canAway?: (side: Side) => boolean;
  onAway?: (playerId: string, at: number | null) => Promise<void>;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [tab, setTab] = useState<'games' | Side>(myTeam && day.rotas[myTeam] ? myTeam : 'games');
  const [show, setShow] = useState<'all' | 'ahead' | 'played' | 'mine'>('all');
  const [view, setView] = useState<'swaps' | 'players'>('swaps');
  // "My turns" only means something on the player's own team.
  const meId = [...people.values()].find((p) => p.me)?.id ?? null;
  const mine = !!meId && tab !== 'games' && tab === myTeam;
  const shows = (f: Fixture) => (show === 'played' ? f.n < gamesDone : show === 'ahead' ? f.n >= gamesDone : true);
  const myTurn = (x: Spell) => !!meId && (x.keeper === meId || x.off.includes(meId));
  const [busy, setBusy] = useState<string | null>(null);
  // "Left early" buttons only once asked for, so the list isn't a row of red buttons.
  const [marking, setMarking] = useState(false);
  const nameOf = (id: string) => people.get(id)?.name ?? 'Someone';
  const moved = new Map((live?.ahead.games ?? []).map((g) => [g.n, g]));
  const dropped = new Set(live ? day.fixtures.slice(gamesDone + (live.playing ? 1 : 0) + live.ahead.games.length).map((f) => f.n) : []);
  const rounds = new Set(day.fixtures.map((f) => f.round)).size;
  const timeOf = (f: Fixture) => moved.get(f.n) ?? f;
  async function away(id: string, at: number | null) {
    if (!onAway) return;
    setBusy(id);
    try {
      await onAway(id, at);
    } finally {
      setBusy(null);
    }
  }

  const rota = tab !== 'games' ? day.rotas[tab] : undefined;
  // Someone who leaves is out from the next game not started yet (by the plan's own times, which
  // the swaps go by, even when the day runs late).
  const nextFixture = day.fixtures[gamesDone + (live?.playing ? 1 : 0)] ?? null;
  const outFrom = (at: number) => (day.fixtures.find((f) => f.start >= at)?.n ?? day.fixtures.length) + 1;

  return (
    <Sheet titleId={titleId} onClose={onClose} align="left" footer={onEdit ? <button onClick={onEdit} className="press w-full min-h-12 rounded-2xl bg-white border border-gray-300 text-[15px] font-bold text-ink hover:border-ink">Change the plan</button> : undefined}>
      <SheetTitle
        id={titleId}
        title="Day plan"
        sub={`${ws ? `Winner stays · ${ws.played.length} game${ws.played.length === 1 ? '' : 's'} so far` : `${day.fixtures.length} games of ${plan.gameMinutes} min`}${plan.swapMinutes ? ` · swaps every ${plan.swapMinutes} min` : ''} · ${plan.onPitch} on the pitch${
          look.kickoff ? ` · ${clockAt(look.kickoff, 0)} to ${clockAt(look.kickoff, plan.pitchMinutes)}` : ''
        }`}
        onClose={onClose}
      />

      {/* Which team (or every game), what to show, and for a team: its swaps or its players */}
      <FilterBar className="mt-4">
        <FilterMenu
          label="Team"
          title="Show the plan for"
          value={tab}
          onChange={(v) => {
            setTab(v);
            if (show === 'mine' && v !== myTeam) setShow('all');
          }}
          columns={2}
          options={[{ value: 'games', label: 'All games' }, ...day.sides.filter((x) => day.rotas[x]).map((x) => ({ value: x, label: `${teamName(x, look.captains, look.bibs)}${x === myTeam ? ' (yours)' : ''}` }))]}
        />
        <FilterMenu
          label="Show"
          title="Show"
          value={show}
          onChange={setShow}
          columns={2}
          options={[
            { value: 'all', label: 'All games' },
            { value: 'ahead', label: 'Still to play' },
            { value: 'played', label: 'Played' },
            ...(mine ? [{ value: 'mine' as const, label: 'My turns in goal and out' }] : []),
          ]}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5.25h18M6.75 12h10.5M10.5 18.75h3" />
            </svg>
          }
        />
      </FilterBar>
      {tab !== 'games' && (
        <div className="mt-3 grid grid-cols-2 gap-1 p-1 bg-white border border-gray-200 rounded-2xl shadow-card" role="tablist" aria-label="Team plan">
          {(
            [
              ['swaps', 'Swaps'],
              ['players', 'Players'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`press h-11 rounded-xl text-[14px] font-bold transition-colors ${view === k ? 'bg-ink text-volt-300' : 'text-ink hover:bg-chalk'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* A steady height, so switching team, tab or filter doesn't make the sheet jump */}
      <div className="min-h-[55vh]">
      {tab === 'games' ? (
        <ol className="mt-3 space-y-1.5">
          {day.fixtures.filter(shows).length === 0 && <Nothing show={show} />}
          {day.fixtures.map((f, i) => {
            if (!shows(f)) return null;
            const done = i < gamesDone ? results[i] : null;
            const on = live?.playing?.n === f.n;
            const t = timeOf(f);
            const off = dropped.has(f.n);
            return (
              <li key={f.n} className="animate-rise" style={stagger(Math.min(i, 12), 20, 0)}>
                {f.round > 1 && day.fixtures[i - 1]?.round !== f.round && (
                  <p className="mt-3 mb-1.5 px-1 text-[12px] font-extrabold text-gray-500">{ws ? `After the first round: first to concede ${plan.firstTo ?? 2}` : rounds > 2 ? `Round ${f.round}` : 'Second round'}</p>
                )}
                <div
                  className={`flex items-center gap-3 min-h-14 px-3.5 py-2 rounded-2xl border ${
                    on ? 'bg-volt-300/35 border-volt-400' : done ? 'bg-chalk border-transparent' : off ? 'bg-white border-dashed border-gray-300 opacity-60' : 'bg-white border-gray-100'
                  }`}
                >
                  <span className="w-14 shrink-0 text-[12px] font-bold text-gray-500 tabular-nums leading-tight">
                    {look.kickoff ? when(look, t.start) : `Game ${f.n + 1}`}
                    <span className="block font-semibold">{off ? 'no time' : `${t.minutes} min`}</span>
                  </span>
                  <span className="flex-1 min-w-0 flex items-center gap-1.5 text-[14px] font-bold text-ink">
                    <SideName t={f.teamA} look={look} className={myTeam === f.teamA ? 'underline underline-offset-2' : ''} />
                    <span className="shrink-0 text-gray-400 font-semibold">v</span>
                    <SideName t={f.teamB} look={look} className={myTeam === f.teamB ? 'underline underline-offset-2' : ''} />
                  </span>
                  <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">
                    {done ? (
                      `${done.scoreA}–${done.scoreB}`
                    ) : on ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px]">
                        <LiveDot /> Live
                      </span>
                    ) : off ? (
                      <span className="text-[12px] text-gray-500">Off</span>
                    ) : ws && i === gamesDone ? (
                      <span className="text-[12px] text-gray-500">Next</span>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
          {!ws && (live?.ahead.late ?? 0) > 0 && (
            <p className="pt-1 px-1 text-[12px] leading-snug text-gray-600">Running {live!.ahead.late} min late: times are moved on, and the end stays the same.</p>
          )}
          {ws && show !== 'played' && (
            <li className="pt-2">
              {ws.over ? (
                <p className="px-1 text-[13px] text-gray-600">Time’s up on the booking.</p>
              ) : (
                <div className="space-y-3">
                  <WsRule ws={ws} plan={plan} />
                  <WsLine ws={ws} look={look} />
                </div>
              )}
              <p className="mt-2 px-1 text-[12px] leading-snug text-gray-500">Times are a guide: winner-stays games end at a goal or the time limit.</p>
            </li>
          )}
        </ol>
      ) : rota ? (
        <div className="mt-3">
          {/* Each player's time over the day */}
          {view === 'players' && (
          <>
          <ul className="rounded-3xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {Object.entries(rota.minutes)
              .sort(([a], [b]) => nameOf(a).localeCompare(nameOf(b)))
              .map(([id, m]) => {
                const p = people.get(id);
                const gone = plan.away?.[id];
                const can = marking && !!onAway && canAway?.(tab as Side);
                return (
                  <li key={id} className="flex items-center gap-3 min-h-14 px-3.5 py-2">
                    <Avatar name={p?.full ?? '?'} photoKey={p?.photoKey} className={`w-9 h-9 text-[11px] ${p?.me ? 'ring-2 ring-ink' : ''}`} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">
                        <span className="truncate">{nameOf(id)}</span>
                        {p?.me && <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-volt-400 text-ink">You</span>}
                      </span>
                      <span className="block text-[12px] text-gray-600 tabular-nums">
                        {gone !== undefined ? `Left · out from game ${outFrom(gone)} · ` : ''}
                        {m.played} min on{m.inGoal ? ` · ${m.inGoal} in goal` : ''}
                        {p?.keeper === 'happy' ? ' · happy in goal' : p?.keeper === 'rather_not' ? ' · rather not in goal' : ''}
                      </span>
                    </span>
                    {can &&
                      (busy === id ? (
                        <BallSpinner className="w-4 h-4" />
                      ) : gone !== undefined ? (
                        <button onClick={() => away(id, null)} className="press shrink-0 min-h-11 px-3 rounded-xl text-[13px] font-bold text-pitch-700 hover:bg-chalk">
                          They’re back
                        </button>
                      ) : (
                        nextFixture && (
                          <button
                            onClick={() => away(id, nextFixture.start)}
                            aria-label={`${nameOf(id)} left early`}
                            className="press shrink-0 min-h-11 px-3 rounded-xl text-[13px] font-bold text-kit-600 hover:bg-kit-500/10"
                          >
                            Left early
                          </button>
                        )
                      ))}
                  </li>
                );
              })}
          </ul>
          {onAway && canAway?.(tab as Side) && (
            <div className="mt-2 px-1">
              <button onClick={() => setMarking((m) => !m)} aria-pressed={marking} className="press min-h-11 px-1 text-[14px] font-bold text-pitch-700">
                {marking ? 'Done' : 'Someone left early?'}
              </button>
              {marking && <p className="text-[12px] leading-snug text-gray-500">Tap Left early: they’re out from the next game and the others share their time.</p>}
            </div>
          )}

          </>
          )}

          {/* Spell by spell */}
          {view === 'swaps' && (
          <ol className="space-y-3">
            {rota.games.every(({ fixture: f, spells: sp }) => (show === 'mine' ? !sp.some(myTurn) : !shows(f))) && <Nothing show={show} />}
            {rota.games.map(({ fixture: f, spells: planned }) => {
              if (show === 'mine' ? !planned.some(myTurn) : !shows(f)) return null;
              const other = f.teamA === tab ? f.teamB : f.teamA;
              const t = timeOf(f);
              const all = dropped.has(f.n) ? [] : clipSpells(planned, t.minutes);
              const spells = show === 'mine' ? all.filter(myTurn) : all;
              const done = f.n < gamesDone;
              const on = live?.playing?.n === f.n;
              const nowSpell = on && live?.elapsed != null ? spellAt(spells, live.elapsed).index : -1;
              return (
                <li key={f.n} className={`rounded-3xl border p-3 ${on ? 'border-volt-400 bg-volt-300/20' : 'border-gray-100 bg-white'} ${done ? 'opacity-70' : ''}`}>
                  <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink">
                    <span className="shrink-0 tabular-nums">{look.kickoff ? when(look, t.start) : `Game ${f.n + 1}`}</span>
                    <span className="shrink-0 text-gray-400">·</span>
                    <span className="shrink-0">v</span>
                    <SideName t={other} look={look} />
                    {done && <span className="ml-auto shrink-0 text-[11px] font-bold text-gray-500">Played</span>}
                    {dropped.has(f.n) && <span className="ml-auto shrink-0 text-[11px] font-bold text-gray-500">No time: ran late</span>}
                    {on && (
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-ink">
                        <LiveDot /> On now
                      </span>
                    )}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {spells.map((s, i) => (
                      <li key={i} className={`grid grid-cols-[3.25rem_1fr] gap-2 rounded-xl px-2 py-1.5 text-[13px] leading-snug ${i === nowSpell ? 'bg-white shadow-card' : ''}`}>
                        <span className="font-bold text-gray-500 tabular-nums">{look.kickoff ? when(look, t.start + s.start) : `${s.start}′`}</span>
                        <span className="min-w-0 text-gray-700">
                          <span aria-hidden>🧤 </span>
                          <b className="text-ink">{s.keeper ? nameOf(s.keeper) : 'Anyone'}</b>
                          {s.off.length > 0 && <span> · sits out: {list(s.off.map(nameOf))}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
          )}
        </div>
      ) : null}
      </div>
    </Sheet>
  );
}

/** What a filter left empty says. */
function Nothing({ show }: { show: string }) {
  return (
    <p className="rounded-3xl bg-chalk px-4 py-6 text-center text-[14px] text-gray-600">
      {show === 'played' ? 'No games played yet.' : show === 'ahead' ? 'Every game is played.' : show === 'mine' ? 'No turns in goal or sitting out for you.' : 'Nothing to show.'}
    </p>
  );
}

/** Everyone in the plan by id, from either side's squad list. */
export function usePeople(squad: { id?: string; firstName?: string; lastName?: string; nickname?: string | null; name?: string; short?: string; photoKey?: string | null; keeper?: KeeperPref; me?: boolean }[]) {
  return useMemo(() => {
    const out = new Map<string, PlanPerson>();
    for (const m of squad) {
      if (!m.id) continue;
      const full = m.name ?? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim();
      out.set(m.id, { id: m.id, name: m.short ?? (m.nickname || m.firstName || full), full, photoKey: m.photoKey, keeper: m.keeper, me: m.me });
    }
    return out;
  }, [squad]);
}
