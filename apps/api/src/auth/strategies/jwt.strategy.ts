import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { COOKIE_NAMES } from '../cookie.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        // Try HttpOnly cookie first, fall back to Bearer header for API clients
        const cookieToken = req?.cookies?.[COOKIE_NAMES.ACCESS];
        if (cookieToken) return cookieToken;
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      secretOrKey: config.get<string>('JWT_SECRET', 'pitchaside-dev-secret'),
    });
  }

  async validate(payload: { sub: string; typ?: string }) {
    // Sessions carry only `sub`; anything typed (the 2FA challenge) is not a session.
    if (payload.typ) throw new UnauthorizedException();
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.removedAt) throw new UnauthorizedException();
    return user;
  }
}
