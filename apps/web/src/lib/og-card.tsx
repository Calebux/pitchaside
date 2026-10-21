/**
 * The pieces every shareable image shares (next/og, rendered by satori): brand colours, a
 * player's face, small caps labels, drawn icons and the PitchAside mark.
 */

/** Where player photos are served from, for the image renderer on the server. */
const API_URL = process.env.API_URL || 'http://localhost:3001';

/** Brand colours (mirrors the @theme tokens in globals.css — satori can't read CSS variables). */
export const C = {
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
export const DISPLAY = 'Bricolage Grotesque';

export function prettyDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

export function initials(name: string) {
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
export function Face({ p, size, ring }: { p: { name: string; photoKey: string | null }; size: number; ring: string }) {
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
export const Star = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill={color} />
  </svg>
);
export const Arrow = ({ up, color }: { up: boolean; color: string }) => (
  <svg width="16" height="14" viewBox="0 0 16 14">
    <path d={up ? 'M8 1 L15 13 L1 13 Z' : 'M1 1 L15 1 L8 13 Z'} fill={color} />
  </svg>
);

export const Label = ({ children, color = C.volt300, size = 20 }: { children: React.ReactNode; color?: string; size?: number }) => (
  <div style={{ display: 'flex', fontSize: size, fontWeight: 700, letterSpacing: 3, color }}>{children}</div>
);

/** The PitchAside mark and name, as in components/brand.tsx, on a volt tile so it reads on dark. */
export function Brand() {
  return (
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
  );
}
