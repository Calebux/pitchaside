// Same as auth.service.spec: keep @nestjs/jwt's ESM out of the test run.
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PlayerAuthService } from './player-auth.service';
import { User } from '../users/entities/user.entity';
import { Player } from '../players/entities/player.entity';

/**
 * The "Playing" switch: an organiser whose email isn't confirmed must prove it with a code before
 * the player side opens, whenever that email already belongs to someone on the player side.
 */
describe('PlayerAuthService.organiserNeedsProof', () => {
  const organiser = (over: Partial<User> = {}) =>
    ({ id: 'u1', email: 'Ada@Example.com', organizationId: 'club-a', emailVerified: false, ...over }) as User;

  function service(players: Partial<Player>[], account: { passwordHash: string | null } | null) {
    const accountsRepo = { findOne: jest.fn().mockResolvedValue(account) };
    const usersRepo = { update: jest.fn() };
    const svc = new PlayerAuthService(
      {} as never,
      {} as never,
      usersRepo as never,
      accountsRepo as never,
      {} as never,
      {} as never,
      { get: () => 'secret' } as never,
      {} as never,
    );
    jest.spyOn(svc, 'findPlayersByKey').mockResolvedValue(players as Player[]);
    return { svc, usersRepo };
  }

  it('lets a confirmed email straight through', async () => {
    const { svc } = service([{ organizationId: 'club-b' }], { passwordHash: 'x' });
    expect(await svc.organiserNeedsProof(organiser({ emailVerified: true }))).toBe(false);
  });

  it('lets an unconfirmed organiser through when the email only plays in their own club', async () => {
    const { svc } = service([{ organizationId: 'club-a' }], null);
    expect(await svc.organiserNeedsProof(organiser())).toBe(false);
  });

  it('asks for a code when the email plays in another club', async () => {
    const { svc } = service([{ organizationId: 'club-a' }, { organizationId: 'club-b' }], null);
    expect(await svc.organiserNeedsProof(organiser())).toBe(true);
  });

  it('asks for a code when someone already set a player password on that email', async () => {
    const { svc } = service([], { passwordHash: 'hash' });
    expect(await svc.organiserNeedsProof(organiser())).toBe(true);
  });

  it('marks the email confirmed once the right code is given', async () => {
    const { svc, usersRepo } = service([], null);
    const verify = jest.spyOn(svc as unknown as { verifyCode: () => Promise<void> }, 'verifyCode').mockResolvedValue();
    await svc.proveOrganiserEmail(organiser(), '123456');
    expect(verify).toHaveBeenCalledWith('ada@example.com', '123456');
    expect(usersRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ emailVerified: true }));
  });

  it('does not confirm the email when the code is wrong, and says so without signing them out', async () => {
    const { svc, usersRepo } = service([], null);
    jest
      .spyOn(svc as unknown as { verifyCode: () => Promise<void> }, 'verifyCode')
      .mockRejectedValue(new UnauthorizedException('Wrong code — check the email and try again'));
    const err = await svc.proveOrganiserEmail(organiser(), '000000').catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toBe('Wrong code — check the email and try again');
    expect(usersRepo.update).not.toHaveBeenCalled();
  });
});
