import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { PlatformController } from './platform.controller';

/** HQ shows every club's data — nothing on it may be reachable by a club's own users. */
describe('PlatformController access', () => {
  const guard = new RolesGuard(new Reflector());
  const routes = Object.getOwnPropertyNames(PlatformController.prototype).filter((name) => name !== 'constructor');

  const contextFor = (role: UserRole, route: string) =>
    ({
      getHandler: () => PlatformController.prototype[route as keyof PlatformController],
      getClass: () => PlatformController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    }) as unknown as ExecutionContext;

  it('has routes to check', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes)('%s is open to super admins', (route) => {
    expect(guard.canActivate(contextFor(UserRole.SUPER_ADMIN, route))).toBe(true);
  });

  it.each(routes.flatMap((route) => [UserRole.ORG_ADMIN, UserRole.MEMBER, UserRole.TREASURER].map((role) => [route, role] as const)))(
    '%s is closed to %s',
    (route, role) => {
      expect(guard.canActivate(contextFor(role, route))).toBe(false);
    },
  );
});
