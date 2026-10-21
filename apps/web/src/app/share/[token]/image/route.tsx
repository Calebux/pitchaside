import { ImageResponse } from 'next/og';
import { fit, loadFonts } from '@/lib/og';
import { API_URL, getMatchCard, type CardPlayer, type MatchCard } from '../match-card';
import { bibOf, teamName } from '@/lib/teams';
import type { TeamKey } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Brand colours (mirrors the @theme tokens in globals.css — satori can't read CSS variables). */
const C = {
  ink: '#0f1a14',
  pitch950: '#071f10',
  pitch900: '#0d331c',
  pitch800: '#124326',
  pitch600: '#1f743a',
  volt300: '#e3fb6c',
  volt400: '#d4f53c',
  sun400: '#facc15',
  kit500: '#f97316',
  chalk: '#f5f3ea',
  muted: 'rgba(255,255,255,0.6)',
  line: 'rgba(255,255,255,0.12)',
};
const DISPLAY = 'Bricolage Grotesque';

/** A side's colour and name on the card: the game's own bibs (custom name first, then captain, then colour). */
function side(team: string, card: MatchCard) {
  const bib = bibOf(team as TeamKey, card.bibs);
  return { name: teamName(team as TeamKey, card.captains as Partial<Record<TeamKey, string>> | undefined, card.bibs), bg: bib.hex, fg: bib.ink ? C.ink : '#ffffff' };
}

function prettyDate(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase();
}

function initials(name: string) {
  return name
    .split(/\s+|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/** Initials discs get a steady brand colour per name, like the app's avatars. */
const DISC = [
  { bg: C.volt400, fg: C.ink },
  { bg: C.sun400, fg: C.ink },
  { bg: C.kit500, fg: C.ink },
  { bg: '#38bdf8', fg: C.ink },
  { bg: '#ffffff', fg: C.ink },
  { bg: C.pitch600, fg: '#ffffff' },
];
const discOf = (name: string) => DISC[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % DISC.length];

/** A player's face: their photo, else their initials on a disc. */
function Face({ p, size, ring = C.pitch950 }: { p: Pick<CardPlayer, 'name' | 'photoKey'>; size: number; ring?: string }) {
  const border = Math.max(3, Math.round(size / 22));
  if (p.photoKey) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${API_URL}/api/photos/${p.photoKey}`}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: size, border: `${border}px solid ${ring}`, objectFit: 'cover' }}
        alt=""
      />
    );
  }
  const d = discOf(p.name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        border: `${border}px solid ${ring}`,
        background: d.bg,
        color: d.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials(p.name)}
    </div>
  );
}

/** Small caps label, like the broadcast graphics. */
const Label = ({ children, color = C.volt300, size = 20 }: { children: React.ReactNode; color?: string; size?: number }) => (
  <div style={{ display: 'flex', fontSize: size, fontWeight: 700, letterSpacing: 3, color }}>{children}</div>
);

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
  const H = 420;

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
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 3, marginTop: 10 }}>POTM</div>
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
          <Face p={star ?? { name: potm.name, photoKey: null }} size={170} ring={C.ink} />
        )}
      </div>

      {/* Name bar */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 0, right: 0, top: 216, alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 4 }}>PLAYER OF THE MATCH</div>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(potm.name, 44, 13), marginTop: 2, textAlign: 'center' }}>{potm.name}</div>
      </div>

      {/* The day in numbers */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 28,
          right: 28,
          bottom: 26,
          borderTop: `3px solid ${C.ink}`,
          paddingTop: 14,
          justifyContent: 'space-around',
        }}
      >
        {stats.map((s) => (
          <div key={s.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, lineHeight: 1 }}>{s.v}</div>
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
              <div style={{ display: 'flex', fontSize: fit(s.name, 28, 14) }}>{s.name}</div>
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
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(s.name, 34, 14) }}>{s.name}</div>
        <div style={{ display: 'flex' }}>
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
        <div style={{ display: 'flex', fontSize: 20, color: C.muted, marginTop: 8 }}>
          {squad.slice(0, 6).map((p) => p.short).join(' · ')}
          {squad.length > 6 ? ` +${squad.length - 6}` : ''}
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
        const who = l.who.length > 1 ? `${l.who[0].short} & ${l.who.length - 1} more` : l.who[0].name;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, height: 62, padding: '0 18px 0 8px', borderRadius: 999, background: 'rgba(255,255,255,0.07)' }}>
            <Face p={l.who[0]} size={50} ring={C.pitch900} />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Label size={16}>{label === 'GOALS' ? 'TOP SCORER' : label === 'ASSISTS' ? 'MOST ASSISTS' : 'MOST SAVES'}</Label>
              <div style={{ display: 'flex', fontSize: fit(who, 26, 18), fontWeight: 700 }}>{who}</div>
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
      ? [{ key: c.key, title: c.title, team: null, name: l.who.map((p) => p.name).join(' & '), votes: l.value, shared: l.who.length > 1, ids: l.who.map((p) => p.id), unit: c.unit }]
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
        {shown.map((a) => {
          const who = (a.ids ?? []).map((id) => byId.get(id)).filter((p): p is CardPlayer => !!p);
          const title = a.key === 'teammate' && a.team ? `Best on ${side(a.team, card).name}` : a.title;
          return (
            <div
              key={`${a.key}-${a.team ?? ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: 314, height: 86, padding: '0 14px 0 10px', borderRadius: 22, background: 'rgba(255,255,255,0.07)', border: `2px solid ${C.line}` }}
            >
              <Face p={who[0] ?? { name: a.name, photoKey: null }} size={60} ring={C.pitch900} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Label size={15}>{title.toUpperCase()}</Label>
                <div style={{ display: 'flex', fontSize: fit(a.name, 24, 14), fontWeight: 700, marginTop: 2 }}>{a.name}</div>
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

/** A player on the pitch, FPL style: face, name tag, and a goal/assist badge when they had one. */
function PitchPlayer({ p, card, sub = false, size = 92 }: { p: CardPlayer; card: MatchCard; sub?: boolean; size?: number }) {
  const bib = p.team ? side(p.team, card) : null;
  const tally = [p.goals ? `${p.goals}G` : null, p.assists ? `${p.assists}A` : null, p.saves ? `${p.saves}S` : null].filter(Boolean).join(' ');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: size + 40, opacity: sub ? 0.92 : 1 }}>
      <div style={{ display: 'flex', position: 'relative' }}>
        <Face p={p} size={size} ring={bib?.bg ?? '#ffffff'} />
        {tally && (
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              right: -14,
              top: -6,
              padding: '2px 10px',
              borderRadius: 999,
              background: C.volt400,
              color: C.ink,
              fontSize: 18,
              fontWeight: 700,
              border: `2px solid ${C.ink}`,
            }}
          >
            {tally}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: -10,
          padding: '4px 14px',
          borderRadius: 10,
          background: C.ink,
          color: '#ffffff',
          fontSize: fit(p.short, 22, 9),
          fontWeight: 700,
        }}
      >
        {p.short}
      </div>
      {p.ovr != null && <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{p.ovr} OVR</div>}
    </div>
  );
}

/**
 * The pitch, FPL style: the Best VII of the Day once the vote has closed (six on the pitch, the
 * sub on the bench); before that, the Team of the Day's side; with no results, who played.
 */
function Pitch({ card, players, compact = false }: { card: MatchCard; players: CardPlayer[]; compact?: boolean }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const vii = (card.vii ?? []).map((id) => byId.get(id)).filter((p): p is CardPlayer => !!p);
  const tod = card.teamOfTheDay;
  let title: string;
  let onPitch: CardPlayer[];
  let bench: CardPlayer | null = null;
  if (vii.length >= 6) {
    title = 'BEST VII OF THE DAY';
    onPitch = vii.slice(0, 6);
    bench = vii[6] ?? null;
  } else if (tod) {
    const s = side(tod.team, card);
    title = `TEAM OF THE DAY · ${s.name.toUpperCase()} · W${tod.w} D${tod.d} L${tod.l}`;
    onPitch = players.filter((p) => p.team === tod.team).slice(0, 7);
  } else {
    title = `${card.notYet ? "WHO'S PLAYING" : 'WHO PLAYED'} · ${players.length}`;
    onPitch = players.slice(0, 7);
  }
  if (!onPitch.length) return null;
  // Short on room (the awards are showing): everyone in one line across the pitch.
  const front = compact ? onPitch : onPitch.slice(0, Math.ceil(onPitch.length / 2));
  const back = onPitch.slice(front.length);
  const size = compact ? 70 : 92;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', height: compact ? 270 : 400, borderRadius: 36, overflow: 'hidden', border: `3px solid ${C.line}` }}>
      {/* Mowed stripes and the lines of a 5-a-side pitch */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: i % 2 ? '#14532d' : '#166534' }} />
        ))}
      </div>
      {/* The lines, when there's room: one row of players across would sit on top of them */}
      {!compact && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, background: 'rgba(255,255,255,0.35)', display: 'flex' }} />
          <div style={{ position: 'absolute', top: 140, left: 424, width: 120, height: 120, borderRadius: 120, border: '3px solid rgba(255,255,255,0.35)', display: 'flex' }} />
          <div style={{ position: 'absolute', top: 110, left: -3, width: 90, height: 180, border: '3px solid rgba(255,255,255,0.35)', display: 'flex' }} />
          <div style={{ position: 'absolute', top: 110, left: 962 - 87, width: 90, height: 180, border: '3px solid rgba(255,255,255,0.35)', display: 'flex' }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <div style={{ display: 'flex', padding: '6px 18px', borderRadius: 999, background: 'rgba(7,31,16,0.85)' }}>
          <Label size={18}>{title}</Label>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {front.map((p) => (
              <PitchPlayer key={p.id} p={p} card={card} size={size} />
            ))}
          </div>
          {back.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              {back.map((p) => (
                <PitchPlayer key={p.id} p={p} card={card} size={size} />
              ))}
            </div>
          )}
        </div>
        {bench && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: compact ? 130 : 170, height: '100%', justifyContent: 'center', background: 'rgba(7,31,16,0.55)' }}>
            <Label size={16} color={C.muted}>SUB</Label>
            <div style={{ display: 'flex', marginTop: 8 }}>
              <PitchPlayer p={bench} card={card} sub size={size} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The day's scorelines as a broadcast strip: each side in its bib colour. */
function Results({ card }: { card: MatchCard }) {
  if (!card.games.length) return null;
  const shown = card.games.slice(-4);
  const more = card.games.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
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
function NoScores() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: 420,
        borderRadius: 28,
        border: '3px dashed rgba(255,255,255,0.18)',
        padding: '0 40px',
      }}
    >
      <Label size={18} color={C.muted}>THE DAY</Label>
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, marginTop: 10 }}>No scores in yet</div>
      <div style={{ display: 'flex', fontSize: 24, color: C.muted, marginTop: 8 }}>The table, top scorer and assists show here once the scores are in.</div>
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
        padding: '52px 56px',
      }}
    >
      {/* Header: brand, then club, date and where the day stands */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Same mark as components/brand.tsx, on a volt tile so it reads on the dark card. */}
          <svg width="56" height="56" viewBox="0 0 40 40">
            <rect x="1" y="1" width="38" height="38" rx="11" fill={C.volt400} />
            <rect x="7" y="8" width="26" height="24" rx="4" fill="none" stroke={C.ink} strokeWidth="2.4" />
            <line x1="20" y1="8" x2="20" y2="32" stroke={C.ink} strokeWidth="2.4" />
            <circle cx="20" cy="20" r="5" fill="none" stroke={C.ink} strokeWidth="2.4" />
            <circle cx="20" cy="20" r="1.6" fill={C.ink} />
          </svg>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 36 }}>
            Pitch<span style={{ color: C.volt300 }}>Aside</span>
          </div>
        </div>
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
        <Label size={22}>{[card.clubName, prettyDate(card.date)].filter(Boolean).join(' · ').toUpperCase()}</Label>
      </div>
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(card.groupName, 62, 24), lineHeight: 1.05, marginTop: 4 }}>
        {card.groupName}
      </div>
      <Results card={card} />

      {/* The hero: Player of the Match card, and the day's table with who stood out */}
      <div style={{ display: 'flex', gap: 24, marginTop: 22 }}>
        <PotmCard card={card} players={players} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {hasTable && <DayTable card={card} />}
          {squadOnly ? <NoScores /> : winnersBlock ? <WinningTeam card={card} players={players} /> : <Performers players={players} max={hasTable ? 2 : 3} />}
        </div>
      </div>

      {hasAwards && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          <Awards card={card} players={players} stats={stats} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
        <Pitch card={card} players={players} compact={hasAwards} />
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          bottom: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 22,
          color: C.muted,
        }}
      >
        <div style={{ display: 'flex' }}>{card.notYet ? `${players.length} playing` : `${card.ballots} of ${card.squadSize} voted`}</div>
        <div style={{ display: 'flex', fontWeight: 700, color: card.open ? C.volt300 : '#ffffff' }}>
          {card.open ? 'Played? Have your say on PitchAside' : card.notYet ? 'PitchAside' : 'Final result · PitchAside'}
        </div>
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await getMatchCard(token);
  if (!card) return new Response('Not found', { status: 404 });
  const fonts = await loadFonts();
  return new ImageResponse(<Card card={card} />, {
    width: 1080,
    height: 1350,
    fonts: fonts.length ? fonts : undefined,
    // Results move while voting is open; keep previews fresh-ish.
    headers: { 'Cache-Control': card.open ? 'public, max-age=60' : 'public, max-age=3600' },
  });
}
