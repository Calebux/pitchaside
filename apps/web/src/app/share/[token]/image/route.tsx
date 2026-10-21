import { ImageResponse } from 'next/og';
import { fit, loadFonts } from '@/lib/og';
import { Brand, C, DISPLAY, Face, Label, initials, loadPhotos, names, oneLine } from '@/lib/og-card';
import { getMatchCard, type CardPlayer, type MatchCard } from '../match-card';
import { bibOf, teamName } from '@/lib/teams';
import type { TeamKey } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** A side's colour and name on the card: the game's own bibs (custom name first, then captain, then colour). */
function side(team: string, card: MatchCard) {
  const bib = bibOf(team as TeamKey, card.bibs);
  return { name: teamName(team as TeamKey, card.captains as Partial<Record<TeamKey, string>> | undefined, card.bibs), bg: bib.hex, fg: bib.ink ? C.ink : '#ffffff' };
}

/** "SAT 10 OCT". */
function dayDate(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();
}

/** Who led a stat on the day (ties share it), or null when nobody recorded any. */
function leader(players: CardPlayer[], key: 'goals' | 'assists' | 'saves') {
  const top = Math.max(0, ...players.map((p) => p[key]));
  if (!top) return null;
  const who = players.filter((p) => p[key] === top);
  return { who, value: top };
}

/**
 * The Player of the Match as a FIFA-style card: rating top left, photo, name on a bar, and the
 * day's numbers underneath. Until the vote closes it's face down: a "?" and the turnout.
 */
function PotmCard({ card, players }: { card: MatchCard; players: CardPlayer[] }) {
  const potm = card.awards.find((a) => a.key === 'potm');
  const winners = (potm?.ids ?? []).map((id) => players.find((p) => p.id === id)).filter((p): p is CardPlayer => !!p);
  const W = 340;
  const H = 396;

  if (!potm || card.open) {
    return (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          background: `linear-gradient(160deg, ${C.pitch800} 0%, ${C.pitch950} 100%)`,
          border: `4px dashed rgba(227,251,108,0.45)`,
        }}
      >
        <Label>PLAYER OF THE MATCH</Label>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 160, color: C.volt300, lineHeight: 1, marginTop: 10 }}>?</div>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, marginTop: 18, textAlign: 'center', padding: '0 24px' }}>
          {card.open ? 'Revealed when the vote closes' : card.notYet ? 'The vote opens at full time' : 'No vote this time'}
        </div>
        {card.open && (
          <div style={{ display: 'flex', fontSize: 24, color: C.muted, marginTop: 8 }}>
            {card.ballots} of {card.squadSize} have voted
          </div>
        )}
      </div>
    );
  }

  const star = winners[0];
  const shown =
    winners.length > 1 ? { main: winners.map((w) => names(w).main).join(' & '), sub: null } : star ? names(star) : { main: potm.name, sub: null };
  const stats = winners.length === 1 && star ? [
    { k: 'GOALS', v: star.goals },
    { k: 'ASSISTS', v: star.assists },
    { k: 'VOTES', v: potm.votes },
  ] : [{ k: 'VOTES', v: potm.votes }, { k: 'SHARED', v: winners.length || 2 }];

  return (
    <div
      style={{
        width: W,
        height: H,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderRadius: 40,
        background: `linear-gradient(160deg, ${C.volt300} 0%, ${C.volt400} 45%, #a9c61f 100%)`,
        border: `4px solid ${C.ink}`,
        color: C.ink,
        padding: '26px 28px',
      }}
    >
      {/* Rating and label, top left, as on a FIFA card */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', top: 26, left: 30 }}>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 80, lineHeight: 1 }}>{star?.ovr ?? '★'}</div>
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 3, marginTop: 2 }}>{star?.ovr ? 'OVR' : ''}</div>
      </div>
      <div style={{ display: 'flex', position: 'absolute', top: 30, right: 28 }}>
        {winners.length > 1 ? (
          <div style={{ display: 'flex' }}>
            {winners.slice(0, 2).map((w, i) => (
              <div key={w.id} style={{ display: 'flex', marginLeft: i ? -60 : 0 }}>
                <Face p={w} size={140} ring={C.ink} />
              </div>
            ))}
          </div>
        ) : (
          <Face p={star ?? { name: potm.name }} size={148} ring={C.ink} />
        )}
      </div>

      {/* Name bar: what the group calls them, and their real name under a nickname */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 24, right: 24, top: 190, alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>PLAYER OF THE MATCH</div>
        {/* A long name takes two lines rather than shrinking to nothing (one, under a nickname) */}
        <div
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineClamp: shown.sub ? 1 : 2,
            maxWidth: W - 48,
            textAlign: 'center',
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: shown.main.length > 14 ? 29 : 42,
            lineHeight: 1.05,
            marginTop: 4,
          }}
        >
          {shown.main}
        </div>
        {shown.sub && <div style={{ ...oneLine, maxWidth: W - 48, fontSize: 20, fontWeight: 700, color: 'rgba(15,26,20,0.7)' }}>{shown.sub}</div>}
      </div>

      {/* The day in numbers */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 28,
          right: 28,
          bottom: 20,
          borderTop: `3px solid ${C.ink}`,
          paddingTop: 10,
          justifyContent: 'space-around',
        }}
      >
        {stats.map((s) => (
          <div key={s.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{s.v}</div>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, letterSpacing: 2, marginTop: 4 }}>{s.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The day's table, Football Manager style: position, side in its bib colour, P, GD, Pts. */
function DayTable({ card }: { card: MatchCard }) {
  const rows = card.standings.slice(0, 4);
  const rowH = rows.length > 3 ? 44 : 50;
  const col = (w: number, align: 'flex-start' | 'center' | 'flex-end' = 'center') => ({ display: 'flex', width: w, justifyContent: align });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 28, background: 'rgba(0,0,0,0.32)', border: `2px solid ${C.line}`, padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 18, fontWeight: 700, letterSpacing: 2, color: C.muted, paddingBottom: 8 }}>
        <div style={col(44, 'flex-start')}>#</div>
        <div style={{ display: 'flex', flex: 1 }}>THE DAY</div>
        <div style={col(44)}>P</div>
        <div style={col(64)}>GD</div>
        <div style={col(70, 'flex-end')}>PTS</div>
      </div>
      {rows.map((r, i) => {
        const s = side(r.team, card);
        const gd = r.gf - r.ga;
        const top = i === 0 && card.teamOfTheDay?.team === r.team;
        return (
          <div
            key={r.team}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: rowH,
              borderTop: `2px solid ${C.line}`,
              fontSize: 28,
              fontWeight: 700,
              color: top ? C.volt300 : '#ffffff',
            }}
          >
            <div style={col(44, 'flex-start')}>{i + 1}</div>
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: s.bg, border: `2px solid ${C.ink}`, display: 'flex' }} />
              <div style={{ ...oneLine, flex: 1, minWidth: 0, paddingRight: 8 }}>{s.name}</div>
            </div>
            <div style={col(44)}>{r.p}</div>
            <div style={col(64)}>{gd > 0 ? `+${gd}` : gd}</div>
            <div style={{ ...col(70, 'flex-end'), fontFamily: DISPLAY, fontWeight: 800 }}>{r.pts}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The side that won the day, under the table when the Best VII has the pitch: its bib colour and
 * name, its record, and its players' faces.
 */
function WinningTeam({ card, players }: { card: MatchCard; players: CardPlayer[] }) {
  const tod = card.teamOfTheDay;
  if (!tod) return null;
  const s = side(tod.team, card);
  const squad = players.filter((p) => p.team === tod.team);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginTop: 12,
        padding: '14px 20px',
        borderRadius: 24,
        background: 'rgba(0,0,0,0.32)',
        border: `2px solid ${C.line}`,
        borderLeft: `10px solid ${s.bg}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Label size={16}>TEAM OF THE DAY</Label>
        <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: C.muted }}>
          W{tod.w} D{tod.d} L{tod.l} · {tod.pts} pts
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <div style={{ ...oneLine, flex: 1, minWidth: 0, paddingRight: 12, fontFamily: DISPLAY, fontWeight: 800, fontSize: 34 }}>{s.name}</div>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {squad.slice(0, 6).map((p, i) => (
            <div key={p.id} style={{ display: 'flex', marginLeft: i ? -14 : 0 }}>
              <Face p={p} size={50} ring={s.bg} />
            </div>
          ))}
          {squad.length > 6 && (
            <div style={{ display: 'flex', marginLeft: -14, width: 50, height: 50, borderRadius: 50, background: C.pitch800, border: `3px solid ${s.bg}`, alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
              +{squad.length - 6}
            </div>
          )}
        </div>
      </div>
      {squad.length > 0 && (
        <div style={{ ...oneLine, fontSize: 20, color: C.muted, marginTop: 8 }}>
          {squad.map((p) => p.short).join(' · ')}
        </div>
      )}
    </div>
  );
}

/** FPL-style top performers: goals, assists, saves, each with the leader's face. */
function Performers({ players, max = 3 }: { players: CardPlayer[]; max?: number }) {
  const rows = (
    [
      ['GOALS', leader(players, 'goals')],
      ['ASSISTS', leader(players, 'assists')],
      ['SAVES', leader(players, 'saves')],
    ] as const
  )
    // Two rows (beside the table): saves go with the awards instead.
    .filter(([label, l]) => !!l && (max > 2 || label !== 'SAVES')) as unknown as [string, { who: CardPlayer[]; value: number }][];
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18, gap: 10 }}>
      {rows.slice(0, max).map(([label, l]) => {
        const who = l.who.length > 1 ? `${l.who[0].short} & ${l.who.length - 1} more` : names(l.who[0]).main;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, height: 62, padding: '0 18px 0 8px', borderRadius: 999, background: 'rgba(255,255,255,0.07)' }}>
            <Face p={l.who[0]} size={50} ring={C.pitch900} />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <Label size={16}>{label === 'GOALS' ? 'TOP SCORER' : label === 'ASSISTS' ? 'MOST ASSISTS' : 'MOST SAVES'}</Label>
              <div style={{ ...oneLine, fontSize: 26, fontWeight: 700 }}>{who}</div>
            </div>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, color: C.volt300 }}>{l.value}</div>
          </div>
        );
      })}
    </div>
  );
}

/** What each voted award is called on the card; Best on your team is per side. */
const AWARD_ORDER = ['engine', 'passing', 'shooting', 'playmaker', 'dribbling', 'defending', 'smartest', 'movement', 'keeper', 'teammate', 'pace'];

/**
 * The day's voted awards beyond Player of the Match, FIFA "team of the week" style: each winner's
 * face, the award, their name and votes. Only awards with enough voters have a winner; at most
 * six fit, the rest are counted.
 */
type Counted = { key: 'goals' | 'assists' | 'saves'; title: string; unit: string };
const COUNTED: Counted[] = [
  { key: 'goals', title: 'Top Scorer', unit: 'goal' },
  { key: 'assists', title: 'Most Assists', unit: 'assist' },
  { key: 'saves', title: 'Most Saves', unit: 'save' },
];

function Awards({ card, players, stats }: { card: MatchCard; players: CardPlayer[]; stats: Counted['key'][] }) {
  const voted = card.awards
    .filter((a) => a.key !== 'potm')
    .sort((a, b) => AWARD_ORDER.indexOf(a.key) - AWARD_ORDER.indexOf(b.key));
  // Counted from the scores, not voted: these come after the three headline awards.
  const counted = COUNTED.filter((c) => stats.includes(c.key)).flatMap((c) => {
    const l = leader(players, c.key);
    return l
      ? [{ key: c.key, title: c.title, team: null, name: l.who.map((p) => names(p).main).join(' & '), votes: l.value, shared: l.who.length > 1, ids: l.who.map((p) => p.id), unit: c.unit }]
      : [];
  });
  const awards = [...voted.slice(0, 3), ...counted, ...voted.slice(3)];
  if (!awards.length) return null;
  const shown = awards.slice(0, 6);
  const more = awards.length - shown.length;
  const byId = new Map(players.map((p) => [p.id, p]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label size={18}>{counted.length && voted.length ? 'AWARDS AND STATS' : counted.length ? 'THE DAY IN STATS' : 'AWARDS · VOTED BY THE PLAYERS'}</Label>
        {more > 0 && <Label size={18} color={C.muted}>{`+${more} MORE`}</Label>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {shown.map((a) => {
          const who = (a.ids ?? []).map((id) => byId.get(id)).filter((p): p is CardPlayer => !!p);
          const title = a.key === 'teammate' && a.team ? `Best on ${side(a.team, card).name}` : a.title;
          const name = who.length ? who.map((p) => names(p).main).join(' & ') : a.name;
          return (
            <div
              key={`${a.key}-${a.team ?? ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: 314, height: 78, padding: '0 14px 0 10px', borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: `2px solid ${C.line}` }}
            >
              <Face p={who[0] ?? { name: a.name }} size={52} ring={C.pitch900} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ ...oneLine, fontSize: 15, fontWeight: 700, letterSpacing: 3, color: C.volt300 }}>{title.toUpperCase()}</div>
                <div style={{ ...oneLine, fontSize: 23, fontWeight: 700, marginTop: 1 }}>{name}</div>
                <div style={{ display: 'flex', fontSize: 16, color: C.muted }}>
                  {'unit' in a ? `${a.votes} ${a.unit}${a.votes === 1 ? '' : 's'}` : `${a.votes} vote${a.votes === 1 ? '' : 's'}`}
                  {a.shared ? ' each' : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A player on the pitch, FPL style: face in their bib colour, the day's goals/assists/saves on a
 * badge top right, their rating on a badge bottom left, and their name on a tag under the face.
 */
function PitchPlayer({ p, card, size }: { p: CardPlayer; card: MatchCard; size: number }) {
  const bib = p.team ? side(p.team, card) : null;
  const tally = [p.goals ? `${p.goals}G` : null, p.assists ? `${p.assists}A` : null, p.saves ? `${p.saves}S` : null].filter(Boolean).join(' ');
  const badge = { display: 'flex', position: 'absolute', padding: '1px 9px', borderRadius: 999, fontSize: 17, fontWeight: 700, border: `2px solid ${C.ink}` } as const;
  const width = size + 64;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width }}>
      <div style={{ display: 'flex', position: 'relative' }}>
        <Face p={p} size={size} ring={bib?.bg ?? '#ffffff'} />
        {tally && <div style={{ ...badge, right: -22, top: -4, background: C.volt400, color: C.ink }}>{tally}</div>}
        {p.ovr != null && (
          <div style={{ ...badge, left: -18, bottom: -2, background: C.ink, color: C.volt300, fontFamily: DISPLAY, fontWeight: 800 }}>{p.ovr}</div>
        )}
      </div>
      <div style={{ ...oneLine, maxWidth: 176, marginTop: 8, padding: '3px 12px', borderRadius: 10, background: C.ink, color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
        {p.short}
      </div>
    </div>
  );
}

/**
 * The pitch, FPL style: the Best VII of the Day once the vote has closed (six on the pitch, the
 * sub on the bench); before that, the Team of the Day's side; with no results, who played. It
 * fills whatever height the card has left, so it never runs into the footer.
 */
function Pitch({ card, players, compact = false }: { card: MatchCard; players: CardPlayer[]; compact?: boolean }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const vii = (card.vii ?? []).map((id) => byId.get(id)).filter((p): p is CardPlayer => !!p);
  const tod = card.teamOfTheDay;
  let title: string;
  let onPitch: CardPlayer[];
  let bench: CardPlayer | null = null;
  let more = 0;
  if (vii.length >= 6) {
    title = 'BEST VII OF THE DAY';
    onPitch = vii.slice(0, 6);
    bench = vii[6] ?? null;
  } else if (tod) {
    const s = side(tod.team, card);
    const squad = players.filter((p) => p.team === tod.team);
    title = `TEAM OF THE DAY · ${s.name.toUpperCase()} · W${tod.w} D${tod.d} L${tod.l}`;
    onPitch = squad.slice(0, 8);
    more = squad.length - onPitch.length;
  } else {
    title = `${card.notYet ? "WHO'S PLAYING" : 'WHO PLAYED'} · ${players.length}`;
    onPitch = players.slice(0, 8);
    more = players.length - onPitch.length;
  }
  if (!onPitch.length) return null;
  // Two lines of players, like a team sheet; smaller faces when the awards are showing above.
  const front = onPitch.slice(0, Math.ceil(onPitch.length / 2));
  const back = onPitch.slice(front.length);
  const size = compact ? 68 : onPitch.length <= 4 ? 112 : 92;
  // The lines are drawn over the playing area; the sub's bench sits to the side of it.
  const benchW = bench ? 190 : 0;
  const field = 956 - benchW;
  const chalk = 'rgba(255,255,255,0.3)';
  const row = (list: CardPlayer[]) => (
    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
      {list.map((p) => (
        <PitchPlayer key={p.id} p={p} card={card} size={size} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flex: 1, position: 'relative', borderRadius: 36, overflow: 'hidden', border: `3px solid ${C.line}` }}>
      {/* Mowed stripes, then the lines of a 5-a-side pitch: halfway line, centre circle, a box at each end */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: benchW, display: 'flex' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: i % 2 ? '#14532d' : '#166534' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: field / 2 - 1, width: 3, background: chalk, display: 'flex' }} />
      <div style={{ position: 'absolute', top: '50%', marginTop: -55, left: field / 2 - 55, width: 110, height: 110, borderRadius: 110, border: `3px solid ${chalk}`, display: 'flex' }} />
      <div style={{ position: 'absolute', top: '50%', marginTop: -75, left: -3, width: 70, height: 150, border: `3px solid ${chalk}`, display: 'flex' }} />
      <div style={{ position: 'absolute', top: '50%', marginTop: -75, left: field - 64, width: 70, height: 150, border: `3px solid ${chalk}`, display: 'flex' }} />

      <div style={{ display: 'flex', flexDirection: 'column', width: field, paddingBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <div style={{ ...oneLine, maxWidth: field - 60, padding: '6px 18px', borderRadius: 999, background: 'rgba(7,31,16,0.85)', fontSize: 18, fontWeight: 700, letterSpacing: 3, color: C.volt300 }}>
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-around', paddingTop: 6 }}>
          {row(front)}
          {back.length > 0 && row(back)}
        </div>
        {more > 0 && (
          <div style={{ display: 'flex', position: 'absolute', right: 18, bottom: 12, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>+{more} more</div>
        )}
      </div>
      {bench && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: benchW, background: C.pitch950, borderLeft: `3px solid ${C.line}` }}>
          <Label size={16} color={C.muted}>SUB</Label>
          <div style={{ display: 'flex', marginTop: 12 }}>
            <PitchPlayer p={bench} card={card} size={size} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The day's scorelines as a broadcast strip: each side in its bib colour. */
function Results({ card }: { card: MatchCard }) {
  if (!card.games.length) return null;
  const shown = card.games.slice(-4);
  const more = card.games.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
      <Label size={18} color={C.muted}>FT</Label>
      {shown.map((g, i) => {
        const a = side(g.teamA, card);
        const b = side(g.teamB, card);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', height: 48, borderRadius: 14, overflow: 'hidden', border: `2px solid ${C.line}`, fontWeight: 700 }}>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', background: a.bg, color: a.fg, fontSize: 20 }}>{initials(a.name)}</div>
            <div style={{ display: 'flex', padding: '0 12px', fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, background: C.ink, height: '100%', alignItems: 'center' }}>
              {g.scoreA}–{g.scoreB}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', background: b.bg, color: b.fg, fontSize: 20 }}>{initials(b.name)}</div>
          </div>
        );
      })}
      {more > 0 && <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>+{more} more</div>}
    </div>
  );
}

/** A day with no scores in yet: say where the results will be, plainly. */
function NoScores({ final }: { final: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: 396,
        borderRadius: 28,
        border: '3px dashed rgba(255,255,255,0.18)',
        padding: '0 40px',
      }}
    >
      <Label size={18} color={C.muted}>THE DAY</Label>
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, marginTop: 10 }}>{final ? 'No scores recorded' : 'No scores in yet'}</div>
      <div style={{ display: 'flex', fontSize: 24, color: C.muted, marginTop: 8 }}>
        {final ? 'Nobody entered the scores for this game.' : 'The table, top scorer and assists show here once the scores are in.'}
      </div>
    </div>
  );
}

function Card({ card }: { card: MatchCard }) {
  const players = card.players ?? [];
  const hasTable = card.standings.some((r) => r.p > 0);
  const hasStats = players.some((p) => p.goals || p.assists || p.saves);
  // Nothing recorded yet: say so beside the Player of the Match; the pitch shows who played.
  // Once the Best VII has the pitch, the day's winners get their own block under the table, and
  // the counted stats join the awards. Otherwise, two stat rows fit beside the table and saves
  // join the awards.
  const viiOnPitch = (card.vii ?? []).filter((id) => players.some((p) => p.id === id)).length >= 6;
  const winnersBlock = viiOnPitch && hasTable && !!card.teamOfTheDay;
  const stats: Counted['key'][] = winnersBlock ? ['goals', 'assists', 'saves'] : hasTable ? ['saves'] : [];
  const hasStatTiles = stats.some((k) => !!leader(players, k));
  const hasAwards = (!card.open && card.awards.some((a) => a.key !== 'potm')) || hasStatTiles;
  const squadOnly = !hasTable && !hasStats;

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: `linear-gradient(180deg, ${C.pitch900} 0%, ${C.pitch950} 55%)`,
        fontFamily: 'DM Sans',
        color: '#ffffff',
        padding: '48px 56px 36px',
      }}
    >
      {/* Header: brand, then club, date and where the day stands */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Brand />
        <div
          style={{
            display: 'flex',
            padding: '10px 22px',
            borderRadius: 999,
            background: card.open || card.notYet ? C.volt400 : '#ffffff',
            color: C.ink,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          {card.open ? 'VOTING OPEN' : card.notYet ? 'MATCH DAY' : 'FULL TIME'}
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 26 }}>
        <Label size={22}>{[card.clubName, dayDate(card.date)].filter(Boolean).join(' · ').toUpperCase()}</Label>
      </div>
      <div style={{ ...oneLine, fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(card.groupName, 56, 24), lineHeight: 1.1, marginTop: 2 }}>
        {card.groupName}
      </div>
      <Results card={card} />

      {/* The hero: Player of the Match card, and the day's table with who stood out */}
      <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
        <PotmCard card={card} players={players} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {hasTable && <DayTable card={card} />}
          {squadOnly ? <NoScores final={!card.open && !card.notYet} /> : winnersBlock ? <WinningTeam card={card} players={players} /> : <Performers players={players} max={hasTable ? 2 : 3} />}
        </div>
      </div>

      {hasAwards && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}>
          <Awards card={card} players={players} stats={stats} />
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, marginTop: 20 }}>
        <Pitch card={card} players={players} compact={hasAwards} />
      </div>

      {/* Footer, in the flow so nothing can run into it */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 22,
          color: C.muted,
        }}
      >
        <div style={{ display: 'flex' }}>{card.notYet ? `${players.length} playing` : card.squadSize ? `${card.ballots} of ${card.squadSize} voted` : ''}</div>
        <div style={{ display: 'flex', fontWeight: 700, color: card.open ? C.volt300 : '#ffffff' }}>
          {card.open ? 'Played? Have your say on PitchAside' : card.notYet ? 'PitchAside' : 'Final result · PitchAside'}
        </div>
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getMatchCard(token);
  if (!found) return new Response('Not found', { status: 404 });
  const [fonts, photos] = await Promise.all([loadFonts(), loadPhotos((found.players ?? []).map((p) => p.photoKey))]);
  const card = { ...found, players: (found.players ?? []).map((p) => ({ ...p, photo: p.photoKey ? (photos.get(p.photoKey) ?? null) : null })) };
  return new ImageResponse(<Card card={card} />, {
    width: 1080,
    height: 1350,
    fonts: fonts.length ? fonts : undefined,
    // Results move while voting is open; keep previews fresh-ish.
    headers: { 'Cache-Control': card.open ? 'public, max-age=60' : 'public, max-age=3600' },
  });
}
