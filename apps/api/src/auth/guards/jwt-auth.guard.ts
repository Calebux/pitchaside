import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../../users/entities/user.entity';
import { ALLOW_TREASURER_KEY } from '../decorators/allow-treasurer.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const req = context.switchToHttp().getRequest();
    if (req.user?.role === UserRole.TREASURER && req.method !== 'GET') {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_TREASURER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) throw new ForbiddenException('Treasurers can only record payments — ask an organiser for this one');
    }
    return true;
  }
}
