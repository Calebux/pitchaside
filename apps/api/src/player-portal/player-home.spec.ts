jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { PlayerPortalService } from './player-portal.service';

/**
 * Home is for the next games and the money. The card, open votes and the table only decorate it:
 * when one of them fails, Home still opens without it rather than failing (an endless loading
 * screen in the app).
 */
describe('PlayerPortalService.home', () => {
  const person: any = { key: 'ada@example.com', players: [{ id: 'ada', organizationId: 'club', firstName: 'Ada', lastName: 'Obi' }] };
  const membership: any = { groupId: 'g1', playerId: 'ada', group: { name: 'Saturday Ballers', organizationId: 'club' }, credit: '0', extra: '0' };

  function service(ratings: Record<string, jest.Mock>) {
    const svc = new PlayerPortalService({} as never, {} as never, {} as never, {} as never, {} as never, ratings as never, {} as never, {} as never, {} as never);
    jest.spyOn(svc as any, 'memberships').mockResolvedValue([membership]);
    jest.spyOn(svc as any, 'upcoming').mockResolvedValue([{ id: 'next-game' }]);
    jest.spyOn(svc as any, 'owed').mockResolvedValue([]);
    jest.spyOn(svc as any, 'organiser').mockResolvedValue(null);
    jest.spyOn(svc as any, 'personInfo').mockReturnValue({ id: 'ada' });
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    return svc;
  }

  it('still opens when the ratings, votes and table all fail', async () => {
    const boom = () => jest.fn().mockRejectedValue(new Error('ratings broke'));
    const svc = service({ getPlayerRatings: boom(), openVotesFor: boom(), getGroupTable: boom() });
    const home = await svc.home(person);
    expect(home.upcoming).toEqual([{ id: 'next-game' }]);
    expect(home.openVotes).toEqual([]);
    expect(home.tables).toEqual([]);
    expect(home.ratings).toBeDefined();
  });

  it('includes the table when it loads', async () => {
    const svc = service({
      getPlayerRatings: jest.fn().mockRejectedValue(new Error('x')),
      openVotesFor: jest.fn().mockResolvedValue([]),
      getGroupTable: jest.fn().mockResolvedValue({ games: 1, rows: [{ player: { id: 'ada', firstName: 'Ada', lastName: 'Obi' }, points: 3 }] }),
    });
    const home = await svc.home(person);
    expect(home.tables).toEqual([expect.objectContaining({ groupId: 'g1', me: { rank: 1, points: 3 } })]);
  });
});
