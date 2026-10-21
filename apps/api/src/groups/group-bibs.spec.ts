import { GroupsService } from './groups.service';

/** New group bibs apply from the next game on: games with scores keep what they were played in. */
describe('GroupsService.update bibs', () => {
  function setup(bibs: unknown) {
    const group = { id: 'g1', organizationId: 'o1', bibs } as any;
    const em = { query: jest.fn(), save: jest.fn(async (g) => g) };
    const groupsRepo = {
      findOne: jest.fn().mockResolvedValue(group),
      manager: { transaction: (fn: (e: typeof em) => unknown) => fn(em) },
    };
    const billing = { ensureCurrentPeriod: jest.fn(), repriceOpenDues: jest.fn() };
    return { svc: new GroupsService(groupsRepo as any, {} as any, billing as any, {} as any, {} as any), em };
  }

  it('pins the old bibs on played games that had none of their own', async () => {
    const { svc, em } = setup({ A: { colour: 'red', name: 'Red Devils' } });
    const saved = await svc.update('g1', { bibs: { A: { colour: 'navy' } } } as any, 'o1');
    expect(saved.bibs).toEqual({ A: { colour: 'navy' } });
    const [sql, params] = em.query.mock.calls[0];
    expect(sql).toMatch(/bibs IS NULL/);
    expect(sql).toMatch(/session_games/);
    expect(params).toEqual([JSON.stringify({ A: { colour: 'red', name: 'Red Devils' } }), 'g1']);
  });

  it('pins the default colours when the group had none set', async () => {
    const { svc, em } = setup(null);
    await svc.update('g1', { bibs: { A: { colour: 'navy' } } } as any, 'o1');
    expect(em.query.mock.calls[0][1][0]).toBe('{}');
  });

  it('leaves games alone when the bibs are not being changed', async () => {
    const { svc, em } = setup(null);
    await svc.update('g1', { name: 'New name' } as any, 'o1');
    expect(em.query).not.toHaveBeenCalled();
  });
});
