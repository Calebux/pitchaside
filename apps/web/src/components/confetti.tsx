'use client';

import type { CSSProperties } from 'react';
import { palette } from '@/components/illustrations';

const colors = [palette.volt, palette.kit, palette.sky, palette.sun, palette.turfLight];

// Spread out with fixed steps rather than Math.random, so server and client render the same pieces.
const pieces = Array.from({ length: 48 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 90) / 100,
  duration: 2.4 + ((i * 29) % 13) / 10,
  drift: ((i * 71) % 140) - 70,
  spin: ((i * 97) % 900) - 450,
  color: colors[i % colors.length],
  square: i % 4 === 0,
}));

/**
 * A single burst of confetti over the whole screen. It falls once and fades out;
 * with reduced motion on, the pieces finish instantly and never show.
 */
export function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block rounded-[2px] animate-confetti"
          style={
            {
              left: `${p.left}%`,
              width: p.square ? 8 : 10,
              height: p.square ? 8 : 5,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
