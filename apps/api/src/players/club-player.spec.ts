import { Repository } from 'typeorm';
import { clubPlayerFor } from './club-player';
import { Player } from './entities/player.entity';

type Row = Partial<Player> & { id: string; organizationId: string };

/** Just enough of a repository to answer the two lookups clubPlayerFor makes (by email, by phone digits). */
function fakeRepo(rows: Row[]) {
  const repo = {
    rows,
    createQueryBuilder: () => {
      let matches = [...rows];
      const qb = {
        where: (_sql: string, params: { org: string }) => {
          matches = matches.filter((r) => r.organizationId === params.org);
          return qb;
        },
        andWhere: (sql: string, params: { key?: string; suffix?: string }) => {
          if (sql.includes('email')) matches = matches.filter((r) => r.email?.toLowerCase() === params.key);
          else matches = matches.filter((r) => (r.phone ?? '').replace(/\D/g, '').endsWith(params.suffix!.slice(1)));
          return qb;
        },
        getOne: async () => matches[0] ?? null,
      };
      return qb;
    },
    create: (row: Partial<Player>) => row,
    save: async (row: Row) => {
      if (!row.id) {
        row.id = `new-${rows.length + 1}`;
        rows.push(row);
      }
      return row;
    },
  };
  return repo as typeof repo & Repository<Player>;
}

const ada = { email: 'Ada@Example.com', firstName: 'Ada', lastName: 'Obi' };

describe('clubPlayerFor', () => {
  it('finds the existing record by email, whatever the letter case', async () => {
    const repo = fakeRepo([{ id: 'p1', organizationId: 'club', email: 'ada@example.com', firstName: 'Ada', lastName: 'Obi' }]);
    const player = await clubPlayerFor(repo, 'club', ada);
    expect(player.id).toBe('p1');
    expect(repo.rows).toHaveLength(1);
  });

  it('creates a record in a club the person is new to', async () => {
    const repo = fakeRepo([{ id: 'p1', organizationId: 'other-club', email: 'ada@example.com' }]);
    const player = await clubPlayerFor(repo, 'club', { ...ada, phone: ' 0803 123 4567 ' });
    expect(player).toMatchObject({ organizationId: 'club', email: 'ada@example.com', phone: '0803 123 4567', firstName: 'Ada' });
    expect(repo.rows).toHaveLength(2);
  });

  it('hands over a phone-only record the organiser made for them, instead of duplicating it', async () => {
    const repo = fakeRepo([{ id: 'p1', organizationId: 'club', phone: '+234 803 123 4567', firstName: 'Ada', lastName: 'O' }]);
    const player = await clubPlayerFor(repo, 'club', { ...ada, phone: '08031234567' });
    expect(player.id).toBe('p1');
    expect(player.email).toBe('ada@example.com');
    expect(repo.rows).toHaveLength(1);
  });

  it("never takes over a record that already has someone else's email", async () => {
    const repo = fakeRepo([{ id: 'p1', organizationId: 'club', phone: '08031234567', email: 'someone.else@example.com' }]);
    const player = await clubPlayerFor(repo, 'club', { ...ada, phone: '08031234567' });
    expect(player.id).not.toBe('p1');
    // The number is already taken in this club, so the new record goes in without it.
    expect(player).toMatchObject({ email: 'ada@example.com', phone: null });
    expect(repo.rows[0].email).toBe('someone.else@example.com');
  });

  it('needs a name to create someone new', async () => {
    await expect(clubPlayerFor(fakeRepo([]), 'club', { email: 'new@example.com' })).rejects.toThrow('First and last name are required');
  });
});
