'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet on phones, centred card on larger screens. Escape or a tap outside closes it.
 * `art` is an optional illustration band on top; tall content scrolls inside the sheet.
 */
export function Sheet({
  titleId,
  onClose,
  art,
  align = 'center',
  children,
}: {
  titleId: string;
  onClose: () => void;
  art?: ReactNode;
  align?: 'center' | 'left';
  children: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    // Stop the page scrolling behind the sheet.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  // Portal to <body> so the sheet sits above the phone tab bar.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-ink/50 backdrop-blur-sm px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-lift w-full sm:max-w-sm max-h-[92vh] overflow-y-auto animate-slide-up sm:animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {art && <div className="bg-volt-300 chalk-dots pt-5 flex justify-center">{art}</div>}
        <div className={`p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:pb-6 ${align === 'center' ? 'text-center' : ''}`}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
