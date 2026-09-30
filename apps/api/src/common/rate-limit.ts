import { ExecutionContext } from '@nestjs/common';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { isIP } from 'net';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  body?: unknown;
}

/** First address in a comma-separated forwarding header, if it really is an IP. */
function firstAddress(header: string | string[] | undefined) {
  const value = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim();
  return value && isIP(value) ? value : null;
}

/**
 * The address of the person making the request, not of the proxy in front of us.
 *
 * In production the browser talks to Vercel, which proxies /api to this server —
 * so the socket address is Vercel's (or Railway's edge) for every user, and
 * limiting on it makes "5 sign-ups a minute" a limit for the whole product.
 * Vercel overwrites both headers below with the visitor's real address.
 *
 * Someone calling this API directly can put anything in these headers, so
 * per-address limits only slow down honest traffic through the site. The limit
 * that protects an account from password guessing is the `account` one below,
 * which can't be dodged that way.
 */
export function clientAddress(req: RequestLike): string {
  return (
    firstAddress(req.headers['x-vercel-forwarded-for']) ??
    firstAddress(req.headers['x-forwarded-for']) ??
    req.ip ??
    'unknown'
  );
}

/** The account a sign-in style request is aimed at: its email, or the user id on the 2FA step. */
function targetAccount(req: RequestLike): string | null {
  const body = req.body as { email?: unknown; userId?: unknown } | undefined;
  const target = typeof body?.email === 'string' ? body.email : typeof body?.userId === 'string' ? body.userId : '';
  return target.trim().toLowerCase() || null;
}

/**
 * Two limits on every rate-limited route:
 *
 * - `default`: per visitor address. Routes tighten or loosen it with @Throttle.
 * - `account`: per targeted account (the email in the request body), wherever the
 *   requests come from — 10 tries a minute at one person's password or code, per
 *   route. Skipped when the request doesn't name an account.
 */
export const rateLimits: ThrottlerModuleOptions = {
  getTracker: (req) => clientAddress(req as RequestLike),
  throttlers: [
    { name: 'default', ttl: 60_000, limit: 10 },
    {
      name: 'account',
      ttl: 60_000,
      limit: 10,
      skipIf: (context: ExecutionContext) => !targetAccount(context.switchToHttp().getRequest()),
      getTracker: (req) => `account:${targetAccount(req as RequestLike)}`,
    },
  ],
};
