'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small "i" beside a label that explains a number people may not know (rating, points, paid
 * ahead). It adds to the label, never replaces it. Tap opens a short note; tap again, the ×,
 * Escape or a tap anywhere else closes it. The visible dot is small but the tap target is 44px.
 * The note is drawn on the page's top layer, so nothing next to it (a sticky bar, a filter row)
 * can cover it. It follows its dot while the page scrolls.
 */
export function InfoTip({
  label,
  children,
  align = 'left',
  tone = 'light',
}: {
  /** What the button says to a screen reader, e.g. "What's the rating?" */
  label: string;
  children: ReactNode;
  /** Which edge the note lines up with, so it stays on screen near the right side. */
  align?: 'left' | 'right';
  /** On a dark card the dot is light. */
  tone?: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  // Where the note sits on screen: under the dot (over it when there's no room below, as the
  // phone tab bar sits at the bottom), lined up with `align` and kept 8px inside the screen.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const place = () => {
    if (!button.current || !note.current) return;
    const b = button.current.getBoundingClientRect();
    const n = note.current.getBoundingClientRect();
    const edge = 8;
    const want = align === 'right' ? b.right - n.width : b.left;
    const left = Math.min(Math.max(edge, want), window.innerWidth - edge - n.width);
    const up = b.bottom + 4 + n.height > window.innerHeight - 96 && b.top - 4 - n.height > 0;
    setPos(up ? { left, bottom: window.innerHeight - b.top + 4 } : { left, top: b.bottom + 4 });
  };
  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
    // Measured on opening; scrolling and resizing re-place it (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !note.current?.contains(t)) setOpen(false);
    };
    // Fixed on screen, so it follows its dot while the page scrolls.
    const scrolled = () => place();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', scrolled, { passive: true, capture: true });
    window.addEventListener('resize', scrolled);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', scrolled, { capture: true });
      window.removeEventListener('resize', scrolled);
    };
  }, [open]);

  return (
    <span ref={wrap} className="relative inline-flex align-middle">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="press -m-3 w-11 h-11 inline-flex items-center justify-center rounded-full"
      >
        <span
          className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[11px] font-extrabold font-display transition-colors ${
            open
              ? 'bg-volt-300 text-ink'
              : tone === 'dark'
                ? 'bg-white/15 text-white/80'
                : 'bg-chalk text-gray-600 border border-gray-200'
          }`}
          aria-hidden
        >
          i
        </span>
      </button>
      {open &&
        createPortal(
        // The outer layer is placed on screen (hidden until measured); the inner one pops in.
        <span
          ref={note}
          style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom } : { left: 0, top: 0, visibility: 'hidden' }}
          className="fixed z-[80] w-[min(18rem,calc(100vw-2.5rem))]"
        >
          <span
            id={id}
            role="note"
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in relative block rounded-2xl bg-ink text-white shadow-lift p-3.5 pr-10 text-left text-[13px] font-normal normal-case tracking-normal leading-snug"
          >
            {children}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              aria-label="Close"
              className="absolute top-1 right-1 w-11 h-11 inline-flex items-center justify-center text-white/60 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </span>,
          document.body,
        )}
    </span>
  );
}
