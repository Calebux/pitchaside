import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/**
 * One game, drawn as a match ticket: the card's content, then (when there is one) a stub below a
 * dashed tear line, with a notch cut on each side where it would tear. The money card is the
 * bank card; a game is the ticket. Dark on Home and the game page, light on the player side.
 * The stub is fixed at `stubHeight` so the notches line up with the tear line.
 */
export function Ticket({
  tone = 'dark',
  stub,
  stubHeight = 52,
  className = '',
  bodyClassName = '',
  children,
  ...rest
}: {
  tone?: 'dark' | 'light';
  /** What's torn off: the next game, the venue, a link. No stub, no notches. */
  stub?: ReactNode;
  stubHeight?: number;
  className?: string;
  /** The ticket's own surface: background, text colour, radius. */
  bodyClassName?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={`ticket ${tone === 'light' ? 'ticket-light' : ''} ${className}`} style={{ '--stub-h': `${stubHeight}px` } as CSSProperties}>
      <div data-stub={stub ? 'true' : 'false'} className={`ticket-body ${bodyClassName}`}>
        {children}
        {stub && <div className="ticket-stub">{stub}</div>}
      </div>
    </section>
  );
}
