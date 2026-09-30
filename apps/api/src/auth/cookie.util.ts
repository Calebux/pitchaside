import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

export const COOKIE_NAMES = {
  ACCESS: 'pitchaside_access',
  REFRESH: 'pitchaside_refresh',
  CSRF: 'pitchaside_csrf',
  PLAYER_ACCESS: 'pitchaside_player_access',
  PLAYER_REFRESH: 'pitchaside_player_refresh',
} as const;

/**
 * Path is "/" on purpose: the Next.js middleware checks the session cookies on
 * page requests (/dashboard, …), and the browser reads the CSRF cookie from
 * those pages to echo it back in a header. Scoped to "/api", neither can see them.
 */
function cookieOptions(config: ConfigService, maxAgeMs: number, httpOnly = true) {
  const isProduction = config.get('NODE_ENV') === 'production';
  const opts: Record<string, any> = {
    httpOnly,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeMs,
  };

  // Set explicit domain so cookies work across www / non-www.
  if (isProduction) {
    const appUrl = config.get('APP_URL', '');
    if (appUrl) {
      try {
        const hostname = new URL(appUrl).hostname;
        if (!hostname.includes('localhost')) {
          opts.domain = hostname;
        }
      } catch {}
    }
  }

  return opts;
}

/**
 * Cookies were first issued with Path=/api. A browser still holding one sends
 * it ahead of the "/" cookie on API calls, so the stale value would win — expire it.
 */
function expireLegacyCookies(res: Response, config: ConfigService, names: string[]) {
  for (const name of names) {
    res.cookie(name, '', { ...cookieOptions(config, 0), path: '/api' });
  }
}

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
) {
  expireLegacyCookies(res, config, [COOKIE_NAMES.ACCESS, COOKIE_NAMES.REFRESH, COOKIE_NAMES.CSRF]);
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, cookieOptions(config, 15 * 60 * 1000));
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000));
  const csrfToken = randomBytes(32).toString('hex');
  res.cookie(COOKIE_NAMES.CSRF, csrfToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000, false));
}

export function clearAuthCookies(res: Response, config: ConfigService) {
  // The CSRF cookie stays: the same browser may still be signed in as a player,
  // and it isn't a credential — it only has to match the header the page sends.
  const names = [COOKIE_NAMES.ACCESS, COOKIE_NAMES.REFRESH];
  expireLegacyCookies(res, config, [...names, COOKIE_NAMES.CSRF]);
  for (const name of names) {
    res.cookie(name, '', { ...cookieOptions(config, 0), maxAge: 0 });
  }
}

export function setPlayerAuthCookies(
  res: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
) {
  expireLegacyCookies(res, config, [COOKIE_NAMES.PLAYER_ACCESS, COOKIE_NAMES.PLAYER_REFRESH, COOKIE_NAMES.CSRF]);
  res.cookie(COOKIE_NAMES.PLAYER_ACCESS, accessToken, cookieOptions(config, 15 * 60 * 1000));
  res.cookie(COOKIE_NAMES.PLAYER_REFRESH, refreshToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000));
  const csrfToken = randomBytes(32).toString('hex');
  res.cookie(COOKIE_NAMES.CSRF, csrfToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000, false));
}

export function clearPlayerAuthCookies(res: Response, config: ConfigService) {
  const names = [COOKIE_NAMES.PLAYER_ACCESS, COOKIE_NAMES.PLAYER_REFRESH];
  expireLegacyCookies(res, config, names);
  for (const name of names) {
    res.cookie(name, '', { ...cookieOptions(config, 0), maxAge: 0 });
  }
}
