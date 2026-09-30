'use client';

/*
 * Hand-built SVG illustrations for PitchAside.
 *
 * Everything is drawn from a few primitives (Player, Ball, Pitch) so the
 * characters and props share one flat, chunky style across the product.
 * Colours come from the Matchday palette in globals.css.
 */

import { useId } from 'react';

export const palette = {
  ink: '#0f1a14',
  chalk: '#f5f3ea',
  white: '#ffffff',
  turf: '#2f8f48',
  turfLight: '#4dab62',
  turfDark: '#1f743a',
  night: '#0d331c',
  volt: '#d4f53c',
  kit: '#ff6a3d',
  sky: '#9fd6fb',
  sun: '#ffc93c',
  gray: '#cac6b7',
};

export const skins = ['#6b3f24', '#8d5a3b', '#b97f57', '#e4b48e'] as const;

type Pt = [number, number];

type Pose = 'run' | 'kick' | 'cheer' | 'stand' | 'celebrate' | 'flag';

// Joint positions in a 100 × 160 box, feet on y≈152.
const poses: Record<Pose, { armL: Pt[]; armR: Pt[]; legL: Pt[]; legR: Pt[] }> = {
  run: {
    armL: [[35, 47], [24, 62], [31, 75]],
    armR: [[65, 47], [78, 58], [85, 45]],
    legL: [[43, 97], [33, 118], [18, 128]],
    legR: [[57, 97], [66, 122], [62, 150]],
  },
  kick: {
    armL: [[35, 47], [19, 57], [8, 50]],
    armR: [[65, 47], [81, 58], [92, 66]],
    legL: [[43, 97], [44, 124], [42, 150]],
    legR: [[57, 97], [75, 111], [95, 104]],
  },
  cheer: {
    armL: [[35, 47], [26, 30], [22, 11]],
    armR: [[65, 47], [74, 30], [78, 11]],
    legL: [[43, 97], [38, 124], [34, 150]],
    legR: [[57, 97], [62, 124], [66, 150]],
  },
  celebrate: {
    armL: [[35, 47], [20, 40], [12, 26]],
    armR: [[65, 47], [80, 40], [88, 26]],
    legL: [[43, 97], [34, 118], [36, 146]],
    legR: [[57, 97], [70, 112], [80, 128]],
  },
  flag: {
    armL: [[35, 48], [29, 67], [29, 85]],
    armR: [[65, 47], [76, 30], [80, 10]],
    legL: [[44, 97], [43, 125], [42, 150]],
    legR: [[56, 97], [57, 125], [58, 150]],
  },
  stand: {
    armL: [[35, 48], [29, 67], [29, 85]],
    armR: [[65, 48], [71, 67], [71, 85]],
    legL: [[44, 97], [43, 125], [42, 150]],
    legR: [[56, 97], [57, 125], [58, 150]],
  },
};

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const poly = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

interface PlayerProps {
  x?: number;
  y?: number;
  scale?: number;
  pose?: Pose;
  kit?: string;
  shorts?: string;
  skin?: string;
  hair?: 'short' | 'afro' | 'buzz' | 'bun';
  number?: number | string;
  numberColor?: string;
  flip?: boolean;
  shadow?: boolean;
}

/** A single footballer, positioned by the centre of their feet. */
export function Player({
  x = 0,
  y = 0,
  scale = 1,
  pose = 'run',
  kit = palette.volt,
  shorts = palette.ink,
  skin = skins[1],
  hair = 'short',
  number,
  numberColor = palette.ink,
  flip = false,
  shadow = true,
}: PlayerProps) {
  const p = poses[pose];
  const limb = 9;
  const sock = (leg: Pt[]) => poly([lerp(leg[1], leg[2], 0.35), leg[2]]);

  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale}) translate(-50 -152)`}>
      {shadow && <ellipse cx="50" cy="154" rx="26" ry="5" fill={palette.ink} opacity="0.16" />}

      {/* Legs */}
      {[p.legL, p.legR].map((leg, i) => (
        <g key={i}>
          <path d={poly(leg)} stroke={skin} strokeWidth={limb} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={sock(leg)} stroke={kit} strokeWidth={limb + 1} strokeLinecap="round" fill="none" />
          <circle cx={leg[2][0]} cy={leg[2][1]} r="6.5" fill={palette.ink} />
        </g>
      ))}

      {/* Shorts */}
      <path d="M31 80 L69 80 L72 100 L53 102 L50 94 L47 102 L28 100 Z" fill={shorts} />

      {/* Torso */}
      <path d="M31 44 Q50 37 69 44 L71 84 Q50 88 29 84 Z" fill={kit} />
      <path d="M43 41 Q50 47 57 41" stroke={palette.ink} strokeOpacity="0.25" strokeWidth="3" fill="none" strokeLinecap="round" />
      {number !== undefined && (
        <text
          x="50"
          y="73"
          transform={flip ? 'translate(100 0) scale(-1 1)' : undefined}
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fontFamily="var(--font-heading), sans-serif"
          fill={numberColor}
        >
          {number}
        </text>
      )}

      {/* Arms: sleeve + forearm */}
      {[p.armL, p.armR].map((arm, i) => (
        <g key={i}>
          <path d={poly(arm)} stroke={skin} strokeWidth={limb - 1} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={poly([arm[0], lerp(arm[0], arm[1], 0.6)])} stroke={kit} strokeWidth={limb + 3} strokeLinecap="round" fill="none" />
        </g>
      ))}

      {/* Head */}
      <rect x="45" y="30" width="10" height="10" rx="3" fill={skin} />
      <circle cx="50" cy="22" r="13" fill={skin} />
      {hair === 'short' && <path d="M37 21 Q38 7 50 7 Q63 7 63 20 Q57 14 50 15 Q42 15 37 21 Z" fill={palette.ink} />}
      {hair === 'buzz' && <path d="M37.5 19 Q40 8.5 50 8.5 Q60 8.5 62.5 19 Q50 13 37.5 19 Z" fill={palette.ink} opacity="0.85" />}
      {hair === 'afro' && (
        <g fill={palette.ink}>
          <circle cx="40" cy="13" r="7" />
          <circle cx="50" cy="8" r="8" />
          <circle cx="60" cy="13" r="7" />
          <circle cx="37" cy="20" r="4.5" />
          <circle cx="63" cy="20" r="4.5" />
        </g>
      )}
      {hair === 'bun' && (
        <g fill={palette.ink}>
          <path d="M37 21 Q38 8 50 8 Q62 8 63 21 Q56 14 50 15 Q43 14 37 21 Z" />
          <circle cx="50" cy="4" r="5" />
        </g>
      )}
      {/* Face: tiny smile + eyes, facing the direction of travel */}
      <circle cx="54" cy="21" r="1.4" fill={palette.ink} />
      <circle cx="60" cy="21" r="1.4" fill={palette.ink} />
      <path d="M54 27 Q57.5 29.5 61 27" stroke={palette.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Classic black-and-white ball, positioned by its centre. */
export function Ball({ x = 0, y = 0, r = 12, spin = 0 }: { x?: number; y?: number; r?: number; spin?: number }) {
  const s = r / 12;
  return (
    <g transform={`translate(${x} ${y}) rotate(${spin}) scale(${s})`}>
      <circle r="12" fill={palette.white} stroke={palette.ink} strokeWidth="1.6" />
      <path d="M0 -4.6 L4.4 -1.4 L2.7 3.7 L-2.7 3.7 L-4.4 -1.4 Z" fill={palette.ink} />
      <path d="M0 -4.6 L0 -9.6 M4.4 -1.4 L9.1 -3 M2.7 3.7 L5.6 7.8 M-2.7 3.7 L-5.6 7.8 M-4.4 -1.4 L-9.1 -3" stroke={palette.ink} strokeWidth="1.3" />
      <path d="M-3 -11.6 L0 -9.6 L3 -11.6 A12 12 0 0 0 -3 -11.6 Z" fill={palette.ink} />
      <path d="M9.1 -3 L11.8 -1.5 A12 12 0 0 0 10.2 -6.3 Z" fill={palette.ink} />
      <path d="M-9.1 -3 L-11.8 -1.5 A12 12 0 0 1 -10.2 -6.3 Z" fill={palette.ink} />
      <path d="M5.6 7.8 L5.4 10.7 A12 12 0 0 0 8.4 8.5 Z" fill={palette.ink} />
      <path d="M-5.6 7.8 L-5.4 10.7 A12 12 0 0 1 -8.4 8.5 Z" fill={palette.ink} />
    </g>
  );
}

export function Sparkle({ x, y, s = 1, color = palette.volt }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10 Z"
      fill={color}
    />
  );
}

function Cone({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="13" ry="3.5" fill={palette.ink} opacity="0.15" />
      <path d="M-11 0 L-3 -24 L3 -24 L11 0 Z" fill={palette.kit} />
      <path d="M-7.3 -11 L7.3 -11 L8.6 -7 L-8.6 -7 Z" fill={palette.white} />
      <rect x="-13" y="-2" width="26" height="4" rx="2" fill={palette.kit} />
    </g>
  );
}

/**
 * A pitch drawn in simple perspective: a trapezoid with mown stripes,
 * halfway line, centre circle and both penalty boxes.
 */
function PerspectivePitch({
  top,
  bottom,
  yTop,
  yBottom,
  cx,
  stripes = 8,
  light = palette.turfLight,
  dark = palette.turf,
  line = 'rgba(255,255,255,0.85)',
}: {
  top: number;
  bottom: number;
  yTop: number;
  yBottom: number;
  cx: number;
  stripes?: number;
  light?: string;
  dark?: string;
  line?: string;
}) {
  // Non-linear depth so stripes compress toward the horizon.
  const yAt = (t: number) => yTop + (yBottom - yTop) * Math.pow(t, 1.35);
  const halfAt = (y: number) => {
    const t = (y - yTop) / (yBottom - yTop);
    return (top + (bottom - top) * t) / 2;
  };
  const band = (t0: number, t1: number) => {
    const y0 = yAt(t0);
    const y1 = yAt(t1);
    const h0 = halfAt(y0);
    const h1 = halfAt(y1);
    return `M${cx - h0} ${y0} L${cx + h0} ${y0} L${cx + h1} ${y1} L${cx - h1} ${y1} Z`;
  };
  const box = (tA: number, tB: number, frac: number) => {
    const yA = yAt(tA);
    const yB = yAt(tB);
    const hA = halfAt(yA) * frac;
    const hB = halfAt(yB) * frac;
    return `M${cx - hA} ${yA} L${cx - hB} ${yB} L${cx + hB} ${yB} L${cx + hA} ${yA}`;
  };
  const midY = yAt(0.5);
  const midHalf = halfAt(midY);
  const circleRx = midHalf * 0.26;
  const circleRy = circleRx * ((yBottom - yTop) / (bottom * 1.1));

  return (
    <g>
      {Array.from({ length: stripes }).map((_, i) => (
        <path key={i} d={band(i / stripes, (i + 1) / stripes)} fill={i % 2 ? dark : light} />
      ))}
      <g stroke={line} strokeWidth="2.5" fill="none" strokeLinejoin="round">
        <path d={band(0, 1)} />
        <path d={`M${cx - midHalf} ${midY} L${cx + midHalf} ${midY}`} />
        <ellipse cx={cx} cy={midY} rx={circleRx} ry={circleRy} />
        <path d={box(0, 0.16, 0.42)} />
        <path d={box(1, 0.82, 0.42)} />
      </g>
      <ellipse cx={cx} cy={midY} rx="3.5" ry="2" fill={line} />
    </g>
  );
}

function Goal({ x, y, w, h, net = 'rgba(255,255,255,0.55)' }: { x: number; y: number; w: number; h: number; net?: string }) {
  const cols = 8;
  const rows = 4;
  return (
    <g>
      <g stroke={net} strokeWidth="1.2">
        {Array.from({ length: cols + 1 }).map((_, i) => (
          <line key={`c${i}`} x1={x + (w / cols) * i} y1={y} x2={x + (w / cols) * i} y2={y + h} />
        ))}
        {Array.from({ length: rows + 1 }).map((_, i) => (
          <line key={`r${i}`} x1={x} y1={y + (h / rows) * i} x2={x + w} y2={y + (h / rows) * i} />
        ))}
      </g>
      <path d={`M${x} ${y + h} L${x} ${y} L${x + w} ${y} L${x + w} ${y + h}`} stroke={palette.white} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/* ─────────────────────────── Scenes ─────────────────────────── */

/** Landing hero — five-a-side in full flow on a tilted pitch. */
export function HeroScene({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 640 520" className={className} role="img" aria-label="Players mid-match on a five-a-side pitch">
      <defs>
        <linearGradient id={`${id}-glow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.volt} stopOpacity="0.55" />
          <stop offset="1" stopColor={palette.volt} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Sun disc + clouds */}
      <circle cx="515" cy="92" r="58" fill={palette.sun} />
      <circle cx="515" cy="92" r="80" fill={palette.sun} opacity="0.18" />
      <g fill={palette.white}>
        <rect x="70" y="70" width="120" height="30" rx="15" />
        <rect x="100" y="52" width="60" height="34" rx="17" />
        <rect x="420" y="150" width="96" height="24" rx="12" />
        <rect x="444" y="136" width="46" height="26" rx="13" />
      </g>

      {/* Pitch */}
      <PerspectivePitch cx={320} top={360} bottom={640} yTop={190} yBottom={500} stripes={9} />
      <Goal x={284} y={160} w={72} h={34} />

      {/* Cones */}
      <Cone x={112} y={470} s={0.9} />
      <Cone x={548} y={430} s={0.75} />

      {/* Players — back to front */}
      <Player x={392} y={270} scale={0.62} pose="stand" kit={palette.kit} skin={skins[3]} hair="buzz" number={1} numberColor={palette.white} flip />
      <Player x={214} y={318} scale={0.78} pose="run" kit={palette.volt} skin={skins[0]} hair="afro" number={7} />
      <Player x={446} y={372} scale={0.9} pose="run" kit={palette.kit} skin={skins[2]} hair="short" number={4} numberColor={palette.white} flip />
      <Player x={292} y={452} scale={1.12} pose="kick" kit={palette.volt} skin={skins[1]} hair="short" number={10} />

      {/* Ball arcing off the striker's boot */}
      <path d="M356 394 Q430 290 512 300" stroke={palette.white} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" fill="none" opacity="0.9" />
      <Ball x={522} y={304} r={15} spin={20} />

      <Sparkle x={604} y={250} s={1.2} />
      <Sparkle x={40} y={200} s={0.9} color={palette.kit} />
      <Sparkle x={582} y={40} s={0.7} color={palette.white} />
      <rect x="0" y="0" width="640" height="200" fill={`url(#${id}-glow)`} opacity="0" />
    </svg>
  );
}

/** Auth side panel — floodlit night game, crowd in the stands. */
export function NightStadium({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const crowd = ['#d4f53c', '#ff6a3d', '#ffffff', '#9fd6fb', '#ffc93c', '#4dab62'];
  return (
    <svg viewBox="0 0 600 720" className={className} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Floodlit five-a-side pitch at night">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#061a0e" />
          <stop offset="1" stopColor="#0d331c" />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7ffd1" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f7ffd1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="600" height="720" fill={`url(#${id}-sky)`} />

      {/* Stars */}
      {[
        [60, 60], [140, 110], [250, 40], [330, 90], [470, 50], [540, 130], [420, 150], [90, 190], [520, 220], [200, 170],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.4 : 2.2} fill="#f7ffd1" opacity={i % 2 ? 0.5 : 0.85} />
      ))}
      <circle cx="470" cy="100" r="22" fill="#f7ffd1" opacity="0.9" />
      <circle cx="480" cy="94" r="20" fill="#061a0e" />

      {/* Floodlight beams */}
      <path d="M92 150 L-40 720 L330 720 Z" fill={`url(#${id}-beam)`} opacity="0.5" />
      <path d="M508 150 L270 720 L640 720 Z" fill={`url(#${id}-beam)`} opacity="0.5" />

      {/* Stands with crowd */}
      <path d="M0 330 L600 330 L600 400 L0 400 Z" fill="#0a2616" />
      {Array.from({ length: 3 }).map((_, row) =>
        Array.from({ length: 30 }).map((_, i) => (
          <circle
            key={`${row}-${i}`}
            cx={10 + i * 20 + (row % 2) * 10}
            cy={346 + row * 18}
            r="6"
            fill={crowd[(i * 7 + row * 3) % crowd.length]}
            opacity={0.35 + ((i + row) % 3) * 0.15}
          />
        )),
      )}
      <rect x="0" y="396" width="600" height="10" fill="#134927" />

      {/* Floodlight towers */}
      {[92, 508].map((x) => (
        <g key={x}>
          <rect x={x - 4} y="150" width="8" height="250" fill="#1d3a28" />
          <rect x={x - 34} y="118" width="68" height="40" rx="6" fill="#1d3a28" />
          {Array.from({ length: 6 }).map((_, i) => (
            <circle key={i} cx={x - 22 + (i % 3) * 22} cy={130 + Math.floor(i / 3) * 16} r="6" fill="#f7ffd1" />
          ))}
        </g>
      ))}

      {/* Pitch */}
      <PerspectivePitch cx={300} top={520} bottom={1000} yTop={406} yBottom={720} stripes={8} light="#2f8f48" dark="#267a3c" />
      <Goal x={262} y={380} w={76} h={30} />

      <Player x={206} y={520} scale={0.8} pose="run" kit={palette.volt} skin={skins[0]} hair="afro" number={9} />
      <Player x={396} y={560} scale={0.9} pose="run" kit={palette.kit} skin={skins[3]} hair="short" number={5} numberColor={palette.white} flip />
      <Player x={300} y={660} scale={1.15} pose="kick" kit={palette.volt} skin={skins[1]} hair="bun" number={11} />
      <Ball x={380} y={612} r={13} spin={-12} />
    </svg>
  );
}

/** Empty groups — a waiting goal, ball on the spot. */
export function EmptyGoal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden>
      <ellipse cx="120" cy="150" rx="110" ry="16" fill={palette.turf} opacity="0.18" />
      <path d="M20 150 Q120 138 220 150" stroke={palette.turfLight} strokeWidth="3" fill="none" opacity="0.5" />
      <g stroke={palette.ink} strokeOpacity="0.18" strokeWidth="1.2">
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={i} x1={40 + i * 16} y1="40" x2={40 + i * 16} y2="146" />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={i} x1="40" y1={40 + i * 17.6} x2="200" y2={40 + i * 17.6} />
        ))}
      </g>
      <path d="M40 148 L40 38 L200 38 L200 148" stroke={palette.ink} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 148 L40 38 L200 38 L200 148" stroke={palette.white} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g className="animate-bounce-ball" style={{ transformOrigin: '120px 136px', transformBox: 'fill-box' }}>
        <Ball x={120} y={128} r={17} spin={10} />
      </g>
      <ellipse cx="120" cy="148" rx="16" ry="3.5" fill={palette.ink} opacity="0.18" />
      <Sparkle x={214} y={22} s={0.9} />
      <Sparkle x={22} y={60} s={0.6} color={palette.kit} />
    </svg>
  );
}

/** Empty players — a row of shirts on a washing line. */
export function KitLine({ className }: { className?: string }) {
  const shirt = (x: number, y: number, color: string, n: number, rot: number, num = palette.ink) => (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d="M-4 -2 L0 6 L4 -2" stroke={palette.ink} strokeWidth="2" fill="none" />
      <path d="M-26 6 L-12 0 Q0 7 12 0 L26 6 L34 24 L22 29 L20 22 L20 62 L-20 62 L-20 22 L-22 29 L-34 24 Z" fill={color} stroke={palette.ink} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M-8 1 Q0 8 8 1" stroke={palette.ink} strokeWidth="2" fill="none" />
      <text x="0" y="44" textAnchor="middle" fontSize="20" fontWeight="800" fontFamily="var(--font-heading), sans-serif" fill={num}>
        {n}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 260 150" className={className} aria-hidden>
      <path d="M8 26 Q130 58 252 26" stroke={palette.ink} strokeWidth="2.5" fill="none" />
      <rect x="2" y="18" width="10" height="130" rx="4" fill={palette.ink} opacity="0.85" />
      <rect x="248" y="18" width="10" height="130" rx="4" fill={palette.ink} opacity="0.85" />
      {shirt(62, 38, palette.volt, 7, -6)}
      {shirt(130, 46, palette.kit, 10, 0, palette.white)}
      {shirt(198, 38, palette.white, 4, 6)}
      <Sparkle x={236} y={100} s={0.7} />
    </svg>
  );
}

/** Empty sessions — tactics clipboard and whistle. */
export function TacticsBoard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden>
      <g transform="rotate(-6 110 90)">
        <rect x="46" y="18" width="128" height="150" rx="14" fill={palette.ink} />
        <rect x="56" y="36" width="108" height="122" rx="8" fill={palette.turf} />
        <g stroke={palette.white} strokeWidth="2" fill="none" opacity="0.9">
          <rect x="64" y="44" width="92" height="106" rx="3" />
          <line x1="64" y1="97" x2="156" y2="97" />
          <circle cx="110" cy="97" r="13" />
          <rect x="90" y="44" width="40" height="16" />
          <rect x="90" y="134" width="40" height="16" />
        </g>
        <g fill={palette.volt} stroke={palette.ink} strokeWidth="1.5">
          <circle cx="84" cy="118" r="6" />
          <circle cx="136" cy="118" r="6" />
          <circle cx="110" cy="80" r="6" />
        </g>
        <g stroke={palette.kit} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M80 70 l8 8 M88 70 l-8 8" />
          <path d="M132 64 l8 8 M140 64 l-8 8" />
        </g>
        <path d="M86 112 Q96 88 106 84" stroke={palette.white} strokeWidth="2" strokeDasharray="3 4" fill="none" />
        <path d="M103 81 l5 3 -4 4" stroke={palette.white} strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="88" y="10" width="44" height="18" rx="6" fill="#9f9b8c" stroke={palette.ink} strokeWidth="2" />
      </g>
      {/* Whistle */}
      <g transform="translate(176 118) rotate(18)">
        <path d="M0 0 L34 0 L34 12 L14 12 A14 14 0 1 1 0 0 Z" fill={palette.sun} stroke={palette.ink} strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="4" cy="13" r="5" fill={palette.ink} />
        <path d="M-10 -2 Q-26 -18 -40 -10" stroke={palette.kit} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <Sparkle x={24} y={40} s={0.8} />
    </svg>
  );
}

/** Payments — a coin stack and a ball-shaped piggy jar. */
export function KittyJar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden>
      <ellipse cx="120" cy="156" rx="96" ry="10" fill={palette.ink} opacity="0.1" />
      {/* Jar */}
      <path d="M72 50 Q66 60 66 78 L66 136 Q66 152 84 152 L156 152 Q174 152 174 136 L174 78 Q174 60 168 50 Z" fill={palette.sky} fillOpacity="0.45" stroke={palette.ink} strokeWidth="2.6" />
      <rect x="68" y="36" width="104" height="18" rx="6" fill={palette.turf} stroke={palette.ink} strokeWidth="2.6" />
      <rect x="104" y="40" width="32" height="5" rx="2.5" fill={palette.ink} />
      {/* Coins inside */}
      {[
        [96, 140], [128, 142], [152, 138], [110, 128], [140, 126], [88, 124],
      ].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="13" ry="5" fill={palette.sun} stroke={palette.ink} strokeWidth="2" />
        </g>
      ))}
      <Ball x={122} y={100} r={20} spin={-15} />
      <path d="M150 70 Q156 84 152 98" stroke={palette.white} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />
      {/* Coin dropping in */}
      <g transform="translate(120 14)">
        <ellipse rx="12" ry="12" fill={palette.sun} stroke={palette.ink} strokeWidth="2.4" />
        <text y="5" textAnchor="middle" fontSize="14" fontWeight="800" fill={palette.ink} fontFamily="var(--font-heading), sans-serif">₦</text>
      </g>
      {/* Side stack */}
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx="204" cy={148 - i * 8} rx="18" ry="6" fill={palette.sun} stroke={palette.ink} strokeWidth="2" />
      ))}
      <Sparkle x={34} y={70} s={0.9} />
      <Sparkle x={210} y={70} s={0.6} color={palette.kit} />
    </svg>
  );
}

/** Success — trophy on a plinth with confetti. */
export function Trophy({ className }: { className?: string }) {
  const confetti = [
    [30, 30, palette.volt, 20], [200, 24, palette.kit, -30], [60, 90, palette.sky, 45], [188, 96, palette.sun, 10],
    [100, 14, palette.kit, 60], [150, 40, palette.volt, -20], [22, 130, palette.kit, 30], [214, 140, palette.volt, -45],
  ] as const;
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden>
      {confetti.map(([x, y, c, r], i) => (
        <rect key={i} x={x} y={y} width="10" height="5" rx="1.5" fill={c} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <ellipse cx="120" cy="178" rx="70" ry="8" fill={palette.ink} opacity="0.12" />
      <rect x="78" y="146" width="84" height="30" rx="6" fill={palette.ink} />
      <rect x="92" y="156" width="56" height="8" rx="2" fill={palette.sun} opacity="0.8" />
      <rect x="104" y="120" width="32" height="28" rx="4" fill={palette.sun} stroke={palette.ink} strokeWidth="2.6" />
      <path d="M70 40 L170 40 L166 72 Q160 118 120 122 Q80 118 74 72 Z" fill={palette.sun} stroke={palette.ink} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M72 50 Q42 50 46 74 Q50 96 78 94" stroke={palette.ink} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M168 50 Q198 50 194 74 Q190 96 162 94" stroke={palette.ink} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M72 50 Q42 50 46 74 Q50 96 78 94" stroke={palette.sun} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M168 50 Q198 50 194 74 Q190 96 162 94" stroke={palette.sun} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M88 52 Q90 88 108 104" stroke={palette.white} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.55" />
      <Ball x={120} y={72} r={16} spin={8} />
      <Sparkle x={210} y={60} s={1} />
      <Sparkle x={30} y={64} s={0.7} color={palette.white} />
    </svg>
  );
}

/** Error / not found — linesman's flag up. */
export function OffsideFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 190" className={className} aria-hidden>
      <ellipse cx="120" cy="176" rx="100" ry="10" fill={palette.turf} opacity="0.2" />
      <Player x={112} y={182} scale={0.85} pose="flag" kit={palette.ink} shorts={palette.ink} skin={skins[1]} hair="buzz" shadow={false} />
      <path d="M137.5 72 L137.5 12" stroke={palette.ink} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M137.5 12 L182 20 L176 36 L182 52 L137.5 45 Z" fill={palette.kit} stroke={palette.ink} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M137.5 12 L160 16 L158 49 L137.5 45 Z" fill={palette.sun} stroke={palette.ink} strokeWidth="2" strokeLinejoin="round" />
      <Ball x={46} y={160} r={14} spin={-20} />
      <path d="M14 142 q8 -6 16 0 M8 128 q10 -8 20 0" stroke={palette.ink} strokeOpacity="0.3" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Sparkle x={220} y={100} s={0.8} />
    </svg>
  );
}

/** Verify your email — a letter with a tick coming out of its envelope. */
export function Envelope({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden>
      <circle cx="100" cy="78" r="62" fill={palette.volt} opacity="0.35" />
      <ellipse cx="100" cy="138" rx="70" ry="7" fill={palette.ink} opacity="0.1" />
      {/* Open flap, behind the letter */}
      <path d="M44 62 L100 22 L156 62 Z" fill={palette.gray} stroke={palette.ink} strokeWidth="2.6" strokeLinejoin="round" />
      {/* The letter */}
      <g transform="rotate(-4 100 60)">
        <rect x="60" y="30" width="80" height="74" rx="8" fill={palette.white} stroke={palette.ink} strokeWidth="2.6" />
        <circle cx="100" cy="58" r="15" fill={palette.volt} stroke={palette.ink} strokeWidth="2.4" />
        <path d="M92.5 58.5 L98 64 L108 52.5" stroke={palette.ink} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Envelope front */}
      <path
        d="M42 62 L100 102 L158 62 L158 124 Q158 134 148 134 L52 134 Q42 134 42 124 Z"
        fill={palette.chalk}
        stroke={palette.ink}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M44 132 L86 93 M156 132 L114 93" stroke={palette.ink} strokeWidth="2.2" strokeLinecap="round" />
      <Ball x={164} y={126} r={11} spin={18} />
      <Sparkle x={28} y={44} s={0.9} color={palette.kit} />
      <Sparkle x={174} y={34} s={0.7} color={palette.ink} />
      <Sparkle x={22} y={108} s={0.6} />
    </svg>
  );
}

/** Welcome / onboarding — player celebrating with ball at their feet. */
export function Celebration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 200" className={className} aria-hidden>
      <circle cx="130" cy="96" r="84" fill={palette.volt} opacity="0.35" />
      <circle cx="130" cy="96" r="60" fill={palette.volt} opacity="0.5" />
      <Player x={124} y={188} scale={1.1} pose="cheer" kit={palette.kit} skin={skins[0]} hair="afro" number={9} numberColor={palette.white} />
      <Ball x={196} y={176} r={14} spin={12} />
      <Sparkle x={34} y={40} s={1.1} color={palette.kit} />
      <Sparkle x={226} y={30} s={0.9} />
      <Sparkle x={236} y={120} s={0.6} color={palette.ink} />
      <Sparkle x={24} y={140} s={0.7} />
    </svg>
  );
}

/** Small decorative ball used in headers and badges. */
export function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="-14 -14 28 28" className={className} aria-hidden>
      <Ball r={12.5} />
    </svg>
  );
}

/** FNV-1a — small, well-spread hash so similar names get different colours. */
function hashName(name: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Final avalanche so the low bits (used for `% n`) are well mixed.
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h = (h ^ (h >>> 12)) >>> 0;
  return h;
}

/** Deterministic kit colour + text colour for a name, so avatars stay stable. */
export function kitFor(name: string) {
  const kits = [
    { bg: 'bg-volt-300', fg: 'text-ink', hex: palette.volt, text: palette.ink },
    { bg: 'bg-kit-400', fg: 'text-white', hex: palette.kit, text: palette.white },
    { bg: 'bg-pitch-600', fg: 'text-white', hex: palette.turf, text: palette.white },
    { bg: 'bg-sky-300', fg: 'text-ink', hex: palette.sky, text: palette.ink },
    { bg: 'bg-sun-400', fg: 'text-ink', hex: palette.sun, text: palette.ink },
    { bg: 'bg-ink', fg: 'text-volt-300', hex: palette.white, text: palette.ink },
  ];
  return kits[hashName(name) % kits.length];
}

/** A small shirt badge with a letter or number — used as a group crest. */
export function JerseyBadge({ label, name, className = 'w-11 h-11' }: { label: string; name: string; className?: string }) {
  const colors = [
    { fill: palette.volt, text: palette.ink },
    { fill: palette.kit, text: palette.white },
    { fill: palette.turf, text: palette.white },
    { fill: palette.sky, text: palette.ink },
    { fill: palette.sun, text: palette.ink },
    { fill: palette.ink, text: palette.volt },
  ];
  const c = colors[hashName(name) % colors.length];
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        d="M14 6 L19 4 Q24 8 29 4 L34 6 L45 13 L40 22 L35 19 L35 44 L13 44 L13 19 L8 22 L3 13 Z"
        fill={c.fill}
        stroke={palette.ink}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <text x="24" y="35" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="var(--font-heading), sans-serif" fill={c.text}>
        {label}
      </text>
    </svg>
  );
}
