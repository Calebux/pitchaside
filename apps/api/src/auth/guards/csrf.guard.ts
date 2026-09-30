import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const SKIP_CSRF_KEY = 'skipCsrf';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Safe methods don't need CSRF protection
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    // Skip for endpoints decorated with @SkipCsrf()
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // If the request uses Bearer auth without cookies, skip CSRF (API clients)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ') && !req.cookies?.['pitchaside_access'] && !req.cookies?.['pitchaside_player_access']) {
      return true;
    }

    // Double-submit cookie validation
    const cookieToken = req.cookies?.['pitchaside_csrf'];
    const headerToken = req.headers['x-csrf-token'] as string;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }
}
