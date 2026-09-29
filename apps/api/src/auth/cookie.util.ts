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

function cookieOptions(config: ConfigService, maxAgeMs: number, httpOnly = true) {
  const isProduction = config.get('NODE_ENV') === 'production';
  return {
    httpOnly,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/api',
    maxAge: maxAgeMs,
  };
}

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, cookieOptions(config, 15 * 60 * 1000));
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000));
  const csrfToken = randomBytes(32).toString('hex');
  res.cookie(COOKIE_NAMES.CSRF, csrfToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000, false));
}

export function clearAuthCookies(res: Response, config: ConfigService) {
  for (const name of [COOKIE_NAMES.ACCESS, COOKIE_NAMES.REFRESH, COOKIE_NAMES.CSRF]) {
    res.cookie(name, '', { ...cookieOptions(config, 0), maxAge: 0 });
  }
}

export function setPlayerAuthCookies(
  res: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(COOKIE_NAMES.PLAYER_ACCESS, accessToken, cookieOptions(config, 15 * 60 * 1000));
  res.cookie(COOKIE_NAMES.PLAYER_REFRESH, refreshToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000));
  const csrfToken = randomBytes(32).toString('hex');
  res.cookie(COOKIE_NAMES.CSRF, csrfToken, cookieOptions(config, 7 * 24 * 60 * 60 * 1000, false));
}

export function clearPlayerAuthCookies(res: Response, config: ConfigService) {
  for (const name of [COOKIE_NAMES.PLAYER_ACCESS, COOKIE_NAMES.PLAYER_REFRESH]) {
    res.cookie(name, '', { ...cookieOptions(config, 0), maxAge: 0 });
  }
}
