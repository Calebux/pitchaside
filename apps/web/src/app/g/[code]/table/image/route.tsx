import { ImageResponse } from 'next/og';
import { fit, loadFonts } from '@/lib/og';
import { getTableCard, lastOf, type TableCard } from '../table-card';
import { Arrow, Brand, C, DISPLAY, Face, Label, Star, prettyDate } from '@/lib/og-card';

export const dynamic = 'force-dynamic';

type Row = TableCard['rows'][number];

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
        <Brand />
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
