'use client';

/*
 * Scenes for onboarding, "Did you know?" tips and loading tips: one per step of a PitchAside week,
 * drawn from the illustration kit (Player, Ball, Sparkle, palette) in the same flat, chunky style.
 * Each loops a little (the scene-* classes in globals.css) and stands still, finished, when the
 * phone asks for less motion. Decorative: the words beside each scene say what it shows.
 */

import { Ball, Player, Sparkle, palette as P, skins } from '@/components/illustrations';

const ink = { stroke: P.ink, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const delay = (s: number) => ({ animationDelay: `${s}s` });
const fly = (fx: number, fy: number, s: number) => ({ ['--fx' as string]: `${fx}px`, ['--fy' as string]: `${fy}px`, animationDelay: `${s}s` });

/** The soft volt glow every scene sits on. */
function Halo() {
  return (
    <>
      <circle cx="130" cy="96" r="84" fill={P.volt} opacity="0.28" />
      <circle cx="130" cy="96" r="58" fill={P.volt} opacity="0.4" />
    </>
  );
}

/** Head and shoulders, for crowds and chats. */
function Bust({ x, y, s = 1, skin = skins[1], kit = P.kit, hair = 'short' }: { x: number; y: number; s?: number; skin?: string; kit?: string; hair?: 'short' | 'afro' | 'buzz' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-22 30 Q-22 12 0 12 Q22 12 22 30 Z" fill={kit} {...ink} />
      <circle cx="0" cy="-2" r="13" fill={skin} {...ink} />
      {hair === 'afro' && <path d="M-14 -4 Q-18 -22 0 -21 Q18 -22 14 -4 Q10 -14 0 -13 Q-10 -14 -14 -4 Z" fill={P.ink} />}
      {hair === 'short' && <path d="M-13 -5 Q-12 -17 0 -16 Q12 -17 13 -5 Q6 -11 -13 -5 Z" fill={P.ink} />}
      {hair === 'buzz' && <path d="M-12 -8 Q0 -18 12 -8" stroke={P.ink} strokeWidth="5" fill="none" strokeLinecap="round" />}
      <circle cx="-4.5" cy="-1" r="1.6" fill={P.ink} />
      <circle cx="4.5" cy="-1" r="1.6" fill={P.ink} />
      <path d="M-4 5 Q0 8 4 5" stroke={P.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** A phone, screen up; children draw on the screen (0,0 is its top left, 64 × 104). */
function Phone({ x, y, rotate = 0, children }: { x: number; y: number; rotate?: number; children?: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x="-6" y="-12" width="76" height="132" rx="14" fill={P.ink} />
      <rect x="0" y="0" width="64" height="104" rx="6" fill={P.chalk} />
      <rect x="24" y="-7" width="16" height="3" rx="1.5" fill={P.gray} opacity="0.5" />
      {children}
    </g>
  );
}

/** A volt tick in a disc: "done", "in", "paid". */
function Tick({ x, y, r = 9, className, style }: { x: number; y: number; r?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <g className={className} style={style}>
      <circle cx={x} cy={y} r={r} fill={P.volt} stroke={P.ink} strokeWidth="2.2" />
      <path d={`M${x - r * 0.42} ${y} L${x - r * 0.08} ${y + r * 0.36} L${x + r * 0.45} ${y - r * 0.36}`} stroke={P.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** A coin with the naira sign. */
function Coin({ x, y, r = 11 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={P.sun} stroke={P.ink} strokeWidth="2.2" />
      <text x={x} y={y + r * 0.42} textAnchor="middle" fontSize={r * 1.2} fontWeight="800" fill={P.ink} fontFamily="var(--font-heading), sans-serif">
        ₦
      </text>
    </g>
  );
}

/** Your group, set up: bibs on the line in team colours, and the match timer. */
export function SceneKit({ className }: { className?: string }) {
  const shirt = 'M-17 -20 L-10 -23 Q0 -16 10 -23 L17 -20 L30 -8 L23 4 L16 0 L16 30 L-16 30 L-16 0 L-23 4 L-30 -8 Z';
  const bibs = [
    [62, P.kit, 'A'],
    [130, P.sun, 'B'],
    [198, P.sky, 'C'],
  ] as const;
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      <path d="M14 46 Q130 70 246 46" stroke={P.ink} strokeWidth="2.6" fill="none" />
      {bibs.map(([x, c, l], i) => (
        <g key={l} className="scene-sway" style={delay(i * 0.5)}>
          <rect x={x - 3} y={52} width="6" height="10" rx="2" fill={P.white} stroke={P.ink} strokeWidth="2" />
          <g transform={`translate(${x} 86)`}>
            <path d={shirt} fill={c} {...ink} />
            <text y="16" textAnchor="middle" fontSize="18" fontWeight="800" fill={P.ink} fontFamily="var(--font-heading), sans-serif">
              {l}
            </text>
          </g>
        </g>
      ))}
      {/* Match timer */}
      <g transform="translate(200 150)">
        <circle r="26" fill={P.white} {...ink} />
        <rect x="-5" y="-34" width="10" height="7" rx="2" fill={P.ink} />
        <circle r="20" fill="none" stroke={P.volt} strokeWidth="5" strokeDasharray="90 200" transform="rotate(-90)" />
        <g className="scene-spin" style={{ transformOrigin: '50% 100%' }}>
          <path d="M0 0 L0 -15" stroke={P.ink} strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle r="3" fill={P.ink} />
      </g>
      <Ball x={58} y={162} r={14} spin={10} />
      <Sparkle x={236} y={100} s={0.8} color={P.kit} />
      <Sparkle x={22} y={120} s={0.7} />
    </svg>
  );
}

/** The group's own account: transfers from players' phones land in it as coins. */
export function SceneBank({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      <Phone x={26} y={44} rotate={-8}>
        <rect x="6" y="10" width="52" height="8" rx="4" fill={P.gray} opacity="0.6" />
        <text x="32" y="44" textAnchor="middle" fontSize="14" fontWeight="800" fill={P.ink} fontFamily="var(--font-heading), sans-serif">
          ₦1,500
        </text>
        <rect x="8" y="56" width="48" height="16" rx="5" fill={P.volt} stroke={P.ink} strokeWidth="1.6" />
        <text x="32" y="68" textAnchor="middle" fontSize="9" fontWeight="800" fill={P.ink} fontFamily="var(--font-body), sans-serif">
          PA7K2QX
        </text>
        <rect x="8" y="80" width="48" height="14" rx="5" fill={P.ink} />
        <text x="32" y="90" textAnchor="middle" fontSize="8" fontWeight="700" fill={P.volt} fontFamily="var(--font-body), sans-serif">
          Send
        </text>
      </Phone>
      {/* Coins on their way */}
      {[0, 0.9, 1.8].map((d) => (
        <g key={d} className="scene-fly" style={fly(84, 20, d)}>
          <Coin x={108} y={84} r={10} />
        </g>
      ))}
      {/* The group account */}
      <g transform="translate(150 70)">
        <rect x="0" y="0" width="92" height="96" rx="14" fill={P.turf} {...ink} />
        <rect x="10" y="12" width="72" height="14" rx="4" fill={P.night} />
        <text x="46" y="23" textAnchor="middle" fontSize="9" fontWeight="800" fill={P.volt} fontFamily="var(--font-body), sans-serif">
          GROUP ACCOUNT
        </text>
        <text x="46" y="46" textAnchor="middle" fontSize="11" fontWeight="800" fill={P.white} fontFamily="var(--font-heading), sans-serif">
          0123 456 789
        </text>
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="46" cy={82 - i * 8} rx="22" ry="6" fill={P.sun} stroke={P.ink} strokeWidth="2" />
        ))}
        <Tick x={86} y={4} r={11} className="scene-tick" style={delay(1.2)} />
      </g>
      <Sparkle x={236} y={36} s={0.9} />
      <Sparkle x={130} y={170} s={0.6} color={P.kit} />
    </svg>
  );
}

/** Inviting players: the group link goes out from your phone to the squad. */
export function SceneInvite({ className }: { className?: string }) {
  const squad = [
    { x: 206, y: 46, skin: skins[0], kit: P.kit, hair: 'afro' as const },
    { x: 222, y: 106, skin: skins[2], kit: P.sky, hair: 'short' as const },
    { x: 196, y: 160, skin: skins[1], kit: P.sun, hair: 'buzz' as const },
  ];
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      <Phone x={36} y={46}>
        <rect x="6" y="12" width="44" height="22" rx="8" fill={P.white} stroke={P.ink} strokeWidth="1.6" />
        <rect x="12" y="20" width="30" height="5" rx="2.5" fill={P.gray} />
        <rect x="14" y="42" width="44" height="30" rx="8" fill={P.volt} stroke={P.ink} strokeWidth="1.6" />
        <path d="M24 57 a5 5 0 0 1 0 -7 l4 -4 a5 5 0 0 1 7 7 l-2 2 M41 55 a5 5 0 0 1 0 7 l-4 4 a5 5 0 0 1 -7 -7 l2 -2" stroke={P.ink} strokeWidth="2" fill="none" strokeLinecap="round" transform="translate(-4 -2)" />
        <rect x="6" y="80" width="40" height="8" rx="4" fill={P.gray} opacity="0.6" />
      </Phone>
      {squad.map((m, i) => (
        <g key={i}>
          <g className="scene-fly" style={fly(m.x - 118, m.y - 86, i * 0.8)}>
            <rect x="104" y="76" width="26" height="18" rx="6" fill={P.volt} stroke={P.ink} strokeWidth="2" />
            <path d="M111 86 h12" stroke={P.ink} strokeWidth="2.2" strokeLinecap="round" />
          </g>
          <g className="scene-bob" style={delay(i * 0.6)}>
            <Bust x={m.x} y={m.y} s={0.9} skin={m.skin} kit={m.kit} hair={m.hair} />
          </g>
          <Tick x={m.x + 18} y={m.y - 14} r={7} className="scene-tick" style={delay(i * 0.8 + 1.6)} />
        </g>
      ))}
      <Sparkle x={24} y={30} s={0.8} color={P.kit} />
    </svg>
  );
}

/** A game on the calendar: the ticket fills up as players tap "I'm in". */
export function SceneTicket({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      <g transform="translate(36 40) rotate(-4)">
        <path d="M0 14 Q0 0 14 0 L174 0 Q188 0 188 14 L188 40 A10 10 0 0 0 188 60 L188 86 Q188 100 174 100 L14 100 Q0 100 0 86 L0 60 A10 10 0 0 0 0 40 Z" fill={P.white} {...ink} />
        <path d="M0 14 Q0 0 14 0 L174 0 Q188 0 188 14 L188 30 L0 30 Z" fill={P.turf} stroke={P.ink} strokeWidth="2.6" />
        <text x="14" y="21" fontSize="12" fontWeight="800" fill={P.volt} fontFamily="var(--font-heading), sans-serif">
          SAT · 8PM
        </text>
        <text x="174" y="21" textAnchor="end" fontSize="10" fontWeight="700" fill={P.white} fontFamily="var(--font-body), sans-serif">
          MATCH DAY
        </text>
        <path d="M130 30 L130 100" stroke={P.ink} strokeWidth="2" strokeDasharray="4 4" />
        <text x="14" y="52" fontSize="11" fontWeight="700" fill={P.ink} opacity="0.7" fontFamily="var(--font-body), sans-serif">
          Who&apos;s in
        </text>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle cx={22 + i * 22} cy="74" r="9" fill="none" stroke={P.gray} strokeWidth="2" strokeDasharray="3 3" />
            <Tick x={22 + i * 22} y={74} r={9} className="scene-tick" style={delay(0.35 * i)} />
          </g>
        ))}
        <text x="159" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill={P.ink} fontFamily="var(--font-heading), sans-serif">
          10
        </text>
        <text x="159" y="80" textAnchor="middle" fontSize="9" fontWeight="700" fill={P.ink} opacity="0.6" fontFamily="var(--font-body), sans-serif">
          players
        </text>
      </g>
      <g className="scene-bob">
        <Player x={226} y={186} scale={0.46} pose="run" kit={P.kit} skin={skins[0]} hair="afro" number={9} numberColor={P.white} />
      </g>
      <Sparkle x={26} y={162} s={0.8} />
      <Sparkle x={236} y={34} s={0.7} color={P.kit} />
    </svg>
  );
}

/** Match day: two sides on the pitch, the score ticking over, the timer running. */
export function SceneMatchDay({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      {/* Pitch */}
      <rect x="18" y="70" width="224" height="108" rx="16" fill={P.turf} {...ink} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={30 + i * 36} y="72" width="18" height="104" fill={P.turfLight} opacity="0.35" />
      ))}
      <path d="M130 72 L130 176" stroke={P.white} strokeWidth="2.2" opacity="0.8" />
      <circle cx="130" cy="124" r="18" fill="none" stroke={P.white} strokeWidth="2.2" opacity="0.8" />
      {/* Scoreboard */}
      <g transform="translate(80 18)">
        <rect width="100" height="40" rx="10" fill={P.ink} />
        <rect x="8" y="10" width="12" height="20" rx="3" fill={P.kit} />
        <rect x="80" y="10" width="12" height="20" rx="3" fill={P.sun} />
        <g className="scene-flip" style={delay(1)}>
          <text x="50" y="29" textAnchor="middle" fontSize="20" fontWeight="800" fill={P.volt} fontFamily="var(--font-heading), sans-serif">
            2 – 1
          </text>
        </g>
      </g>
      <Player x={92} y={172} scale={0.56} pose="kick" kit={P.kit} skin={skins[1]} hair="short" number={7} numberColor={P.white} />
      <Player x={172} y={172} scale={0.56} pose="run" kit={P.sun} skin={skins[2]} hair="afro" number={4} flip />
      <g className="scene-bob">
        <Ball x={128} y={142} r={10} spin={20} />
      </g>
      {/* Timer */}
      <g transform="translate(224 40)">
        <circle r="18" fill={P.white} {...ink} />
        <g className="scene-spin" style={{ transformOrigin: '50% 100%' }}>
          <path d="M0 0 L0 -11" stroke={P.ink} strokeWidth="2.6" strokeLinecap="round" />
        </g>
        <circle r="2.5" fill={P.ink} />
      </g>
      <Sparkle x={30} y={36} s={0.8} color={P.kit} />
    </svg>
  );
}

/** Full time: the vote goes in, Player of the Match takes the trophy. */
export function SceneVote({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      {/* Ballot box */}
      <g transform="translate(26 92)">
        <rect x="0" y="16" width="78" height="66" rx="10" fill={P.white} {...ink} />
        <rect x="16" y="10" width="46" height="10" rx="4" fill={P.ink} />
        <path d="M14 46 L64 46" stroke={P.gray} strokeWidth="3" strokeLinecap="round" />
        <text x="39" y="70" textAnchor="middle" fontSize="11" fontWeight="800" fill={P.ink} fontFamily="var(--font-heading), sans-serif">
          VOTE
        </text>
        <g className="scene-drop">
          <rect x="24" y="-18" width="30" height="22" rx="4" fill={P.volt} stroke={P.ink} strokeWidth="2" />
          <path d="M33 -7 l4 4 l8 -8" stroke={P.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      {/* The winner */}
      <Player x={176} y={184} scale={0.74} pose="cheer" kit={P.kit} skin={skins[0]} hair="afro" number={10} numberColor={P.white} />
      <g className="scene-bob">
        <path d="M156 26 L196 26 L194 40 Q190 58 176 60 Q162 58 158 40 Z" fill={P.sun} {...ink} />
        <path d="M157 30 Q144 30 146 40 Q148 48 159 48 M195 30 Q208 30 206 40 Q204 48 193 48" stroke={P.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="170" y="60" width="12" height="8" fill={P.sun} stroke={P.ink} strokeWidth="2" />
        <rect x="164" y="68" width="24" height="6" rx="2" fill={P.ink} />
      </g>
      <Sparkle x={224} y={34} s={0.9} />
      <Sparkle x={132} y={20} s={0.7} color={P.kit} />
      <g className="scene-tick" style={delay(1.4)}>
        <Sparkle x={230} y={96} s={1.1} />
      </g>
    </svg>
  );
}

/** Your player card: your photo, your nickname, your rating. */
export function SceneCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      <g transform="translate(78 16) rotate(-5)">
        <rect width="104" height="146" rx="16" fill={P.night} {...ink} />
        <rect x="8" y="8" width="88" height="96" rx="10" fill={P.turf} />
        <text x="16" y="30" fontSize="22" fontWeight="800" fill={P.volt} fontFamily="var(--font-heading), sans-serif">
          85
        </text>
        <text x="17" y="40" fontSize="7" fontWeight="800" fill={P.white} opacity="0.7" fontFamily="var(--font-body), sans-serif">
          OVR
        </text>
        <svg x="26" y="14" width="70" height="92" viewBox="0 0 100 150" overflow="visible">
          <Player x={50} y={150} scale={1} pose="stand" kit={P.sky} skin={skins[1]} hair="afro" number={9} shadow={false} />
        </svg>
        <rect x="12" y="112" width="80" height="22" rx="7" fill={P.ink} />
        <text x="52" y="127" textAnchor="middle" fontSize="10" fontWeight="800" fill={P.volt} fontFamily="var(--font-heading), sans-serif">
          “Baba Ijebu”
        </text>
      </g>
      {/* The camera that sets the photo */}
      <g transform="translate(186 112)">
        <circle r="22" fill={P.volt} {...ink} />
        <rect x="-11" y="-7" width="22" height="16" rx="4" fill={P.ink} />
        <rect x="-5" y="-10" width="10" height="4" rx="1.5" fill={P.ink} />
        <circle cx="0" cy="1" r="4.5" fill={P.volt} />
        <circle className="scene-flash" r="30" fill={P.white} opacity="0" />
      </g>
      <Sparkle x={38} y={50} s={0.9} color={P.kit} />
      <Sparkle x={228} y={40} s={0.8} />
      <Sparkle x={52} y={150} s={0.6} />
    </svg>
  );
}

/** Getting paid out: money leaves the group account for the pitch owner's bank. */
export function ScenePayout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 190" className={className} aria-hidden>
      <Halo />
      <g transform="translate(18 60)">
        <rect width="86" height="80" rx="14" fill={P.turf} {...ink} />
        <text x="43" y="24" textAnchor="middle" fontSize="9" fontWeight="800" fill={P.volt} fontFamily="var(--font-body), sans-serif">
          GROUP
        </text>
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="43" cy={62 - i * 8} rx="20" ry="6" fill={P.sun} stroke={P.ink} strokeWidth="2" />
        ))}
      </g>
      {[0, 1].map((d) => (
        <g key={d} className="scene-fly" style={fly(96, -6, d * 1.3)}>
          <Coin x={112} y={98} r={10} />
        </g>
      ))}
      {/* Pitch owner */}
      <g transform="translate(168 50)">
        <rect x="0" y="0" width="78" height="96" rx="12" fill={P.white} {...ink} />
        <path d="M0 30 L78 30" stroke={P.ink} strokeWidth="2" />
        <rect x="8" y="8" width="62" height="16" rx="5" fill={P.ink} />
        <text x="39" y="20" textAnchor="middle" fontSize="8" fontWeight="800" fill={P.volt} fontFamily="var(--font-body), sans-serif">
          PITCH OWNER
        </text>
        <rect x="10" y="42" width="58" height="34" rx="6" fill={P.turf} />
        <path d="M39 42 L39 76" stroke={P.white} strokeWidth="1.6" opacity="0.8" />
        <circle cx="39" cy="59" r="7" fill="none" stroke={P.white} strokeWidth="1.6" opacity="0.8" />
        <Tick x={74} y={4} r={11} className="scene-tick" style={delay(1.6)} />
      </g>
      <Sparkle x={128} y={40} s={0.8} />
      <Sparkle x={130} y={160} s={0.6} color={P.kit} />
    </svg>
  );
}
