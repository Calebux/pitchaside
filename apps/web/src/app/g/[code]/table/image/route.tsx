import { ImageResponse } from 'next/og';
import { fit, loadFonts } from '@/lib/og';
import { API_URL, getTableCard, lastOf, type TableCard } from '../table-card';

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
type Row = TableCard['rows'][number];

function prettyDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

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
function Face({ p, size, ring }: { p: Pick<Row, 'name' | 'photoKey'>; size: number; ring: string }) {
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

/** Drawn, not typed: the card's fonts have no ★ ▲ ▼. */
const Star = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill={color} />
  </svg>
);
const Arrow = ({ up, color }: { up: boolean; color: string }) => (
  <svg width="16" height="14" viewBox="0 0 16 14">
    <path d={up ? 'M8 1 L15 13 L1 13 Z' : 'M1 1 L15 1 L8 13 Z'} fill={color} />
  </svg>
);

const Label = ({ children, color = C.volt300, size = 20 }: { children: React.ReactNode; color?: string; size?: number }) => (
  <div style={{ display: 'flex', fontSize: size, fontWeight: 700, letterSpacing: 3, color }}>{children}</div>
);

/** Places up or down since the match day before: ▲2 green, ▼1 orange, or a dash. */
function Move({ move }: { move: number | null }) {
  const up = (move ?? 0) > 0;
  const down = (move ?? 0) < 0;
  return (
    <div style={{ display: 'flex', width: 54, justifyContent: 'center', alignItems: 'center', gap: 4, fontSize: 20, fontWeight: 700, color: up ? C.volt300 : down ? C.kit500 : C.muted }}>
      {up || down ? <Arrow up={up} color={up ? C.volt300 : C.kit500} /> : null}
      {up ? move : down ? -move! : '–'}
    </div>
  );
}

/** The last three match days as lettered chips, coloured too: W volt, D grey, L orange. */
function Form({ form }: { form: Row['form'] }) {
  return (
    <div style={{ display: 'flex', gap: 5, width: 112, justifyContent: 'center' }}>
      {form.length ? (
        form.map((f, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              width: 30,
              height: 30,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              fontWeight: 700,
              background: f === 'W' ? C.volt400 : f === 'L' ? C.kit500 : 'rgba(255,255,255,0.25)',
              color: C.ink,
            }}
          >
            {f}
          </div>
        ))
      ) : (
        <div style={{ display: 'flex', fontSize: 20, color: C.muted }}>–</div>
      )}
    </div>
  );
}

/**
 * One of the top three, FIFA-card style: rank, face, name, points, record. First is the tall
 * volt card in the middle; second and third stand either side.
 */
function Podium({ r, rank }: { r: Row; rank: 1 | 2 | 3 }) {
  const first = rank === 1;
  const accent = first ? C.volt400 : rank === 2 ? C.chalk : C.kit500;
  const W = first ? 320 : 290;
  const H = first ? 420 : 360;
  return (
    <div
      style={{
        width: W,
        height: H,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        borderRadius: 36,
        background: first ? `linear-gradient(160deg, ${C.volt300} 0%, ${C.volt400} 50%, #a9c61f 100%)` : `linear-gradient(160deg, ${C.pitch800} 0%, ${C.pitch900} 100%)`,
        border: `4px solid ${first ? C.ink : accent}`,
        color: first ? C.ink : '#ffffff',
        padding: '22px 18px',
      }}
    >
      <div style={{ display: 'flex', position: 'absolute', top: 18, left: 22, fontFamily: DISPLAY, fontWeight: 800, fontSize: first ? 64 : 52, lineHeight: 1, color: first ? C.ink : accent }}>
        {rank}
      </div>
      {r.potmWins > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'absolute', top: 22, right: 22, fontSize: 22, fontWeight: 700, color: first ? C.ink : C.sun400 }}>
          <Star color={first ? C.ink : C.sun400} />
          {r.potmWins}
        </div>
      )}
      <div style={{ display: 'flex', marginTop: first ? 34 : 30 }}>
        <Face p={r} size={first ? 150 : 120} ring={first ? C.ink : accent} />
      </div>
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(r.name, first ? 36 : 30, 13), marginTop: 12, textAlign: 'center' }}>{r.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: first ? 10 : 6 }}>
        <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: first ? 84 : 64, lineHeight: 1 }}>{r.points}</div>
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>PTS</div>
      </div>
      <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, marginTop: 8, color: first ? 'rgba(15,26,20,0.75)' : C.muted }}>
        W{r.w} D{r.d} L{r.l} · {r.games} match day{r.games === 1 ? '' : 's'}
      </div>
    </div>
  );
}

/** Places four to ten, Football Manager style: place, move, face, name, match days, games W-D-L, form, points. */
function Rows({ rows, from }: { rows: Row[]; from: number }) {
  const head = { display: 'flex', fontSize: 17, fontWeight: 700, letterSpacing: 2, color: C.muted };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 28, background: 'rgba(0,0,0,0.32)', border: `2px solid ${C.line}`, padding: '12px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
        <div style={{ ...head, width: 44 }}>#</div>
        <div style={{ ...head, width: 54 }} />
        <div style={{ ...head, flex: 1, marginLeft: 58 }}>PLAYER</div>
        <div style={{ ...head, width: 50, justifyContent: 'center' }}>DAYS</div>
        <div style={{ ...head, width: 120, justifyContent: 'center' }}>W-D-L</div>
        <div style={{ ...head, width: 112, justifyContent: 'center' }}>FORM</div>
        <div style={{ ...head, width: 70, justifyContent: 'flex-end' }}>PTS</div>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', height: 62, borderTop: `2px solid ${C.line}`, fontSize: 26, fontWeight: 700 }}>
          <div style={{ display: 'flex', width: 44 }}>{from + i}</div>
          <Move move={r.move} />
          <div style={{ display: 'flex', margin: '0 14px 0 4px' }}>
            <Face p={r} size={44} ring={C.pitch900} />
          </div>
          <div style={{ display: 'flex', flex: 1, fontSize: fit(r.name, 26, 16) }}>{r.name}</div>
          <div style={{ display: 'flex', width: 50, justifyContent: 'center' }}>{r.games}</div>
          <div style={{ display: 'flex', width: 120, justifyContent: 'center', fontSize: 22, color: C.muted }}>
            {r.w}-{r.d}-{r.l}
          </div>
          <Form form={r.form} />
          <div style={{ display: 'flex', width: 70, justifyContent: 'flex-end', fontFamily: DISPLAY, fontWeight: 800, fontSize: 32, color: C.volt300 }}>{r.points}</div>
        </div>
      ))}
    </div>
  );
}

function Card({ t }: { t: TableCard }) {
  const [first, second, third] = t.rows;
  const rest = t.rows.slice(3);
  const when = t.last ? `LAST ${t.games} MATCH DAYS` : `AFTER ${t.games} MATCH DAY${t.games === 1 ? '' : 'S'}`;
  const more = t.total - t.rows.length;

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
      {/* Mowed stripes, faint */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }} />
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
        <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: '#ffffff', color: C.ink, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
          THE TABLE
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 26 }}>
        <Label size={22}>{[t.clubName, when, t.lastDate ? prettyDate(t.lastDate) : null].filter(Boolean).join(' · ').toUpperCase()}</Label>
      </div>
      <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: fit(t.groupName, 62, 24), lineHeight: 1.05, marginTop: 4 }}>{t.groupName}</div>

      {!first ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontWeight: 800, fontSize: 56 }}>No points yet</div>
          <div style={{ display: 'flex', fontSize: 28, color: C.muted, marginTop: 10 }}>The table fills up after the first match day with scores.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* The top three, first in the middle and tallest */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 22, marginTop: 30 }}>
            {second && <Podium r={second} rank={2} />}
            <Podium r={first} rank={1} />
            {third && <Podium r={third} rank={3} />}
          </div>
          {rest.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
              <Rows rows={rest} from={4} />
            </div>
          )}
        </div>
      )}

      {/* Footer: how points are won, and how many more are in the full table */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          bottom: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 20,
          color: C.muted,
        }}
      >
        <div style={{ display: 'flex' }}>
          Win {t.points.win} · Draw {t.points.draw} · Team of the Day +{t.points.teamOfDay} · Player of the Match +{t.points.potm}
        </div>
        <div style={{ display: 'flex', fontWeight: 700, color: '#ffffff' }}>{more > 0 ? `+${more} more on PitchAside` : 'PitchAside'}</div>
      </div>
    </div>
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const last = lastOf(new URL(req.url).searchParams.get('last'));
  const t = await getTableCard(code, last);
  if (!t) return new Response('Not found', { status: 404 });
  const fonts = await loadFonts();
  return new ImageResponse(<Card t={t} />, {
    width: 1080,
    height: 1350,
    fonts: fonts.length ? fonts : undefined,
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
