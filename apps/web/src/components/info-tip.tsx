'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A small "i" beside a label that explains a number people may not know (rating, points, paid
 * ahead). It adds to the label, never replaces it. Tap opens a short note; tap again, the ×,
 * Escape or a tap anywhere else closes it. The visible dot is small but the tap target is 44px.
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
  // Nudged sideways so the note never runs off a narrow screen.
  const [shift, setShift] = useState(0);
  // Opens upward when there's no room below (the phone tab bar sits at the bottom).
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    if (!open || !note.current) {
      setShift(0);
      setUp(false);
      return;
    }
    const r = note.current.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 96 && r.top - r.height - 60 > 0) setUp(true);
    const edge = 8;
    const left = r.left - shift;
    const right = r.right - shift;
    setShift(left < edge ? edge - left : right > window.innerWidth - edge ? window.innerWidth - edge - right : 0);
    // Measured once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
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
      {open && (
        // The outer layer is placed (and nudged on screen); the inner one pops in.
        <span
          ref={note}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          className={`absolute ${up ? 'bottom-full mb-2' : 'top-full mt-2'} z-40 w-[min(18rem,calc(100vw-2.5rem))] ${align === 'right' ? 'right-0 -mr-3' : 'left-0 -ml-3'}`}
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
        </span>
      )}
    </span>
  );
}
