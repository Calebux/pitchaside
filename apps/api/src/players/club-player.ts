import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { emailKey, phoneKey } from '../common/format.util';
import { Player } from './entities/player.entity';

export interface ClubPerson {
  email: string;
  phone?: string | null;
  firstName?: string;
  lastName?: string;
}

/**
 * This person's player record in one club, created if they're new there.
 *
 * People are matched by email. The one exception keeps history for players an
 * organiser added by phone number before email sign-in existed: if the club has
 * a record with this person's number and no email, that record is theirs.
 */
export async function clubPlayerFor(repo: Repository<Player>, organizationId: string, person: ClubPerson): Promise<Player> {
  const key = emailKey(person.email);
  const inClub = () => repo.createQueryBuilder('p').where('p.organizationId = :org', { org: organizationId });

  const byEmail = await inClub().andWhere('lower(p.email) = :key', { key }).getOne();
  if (byEmail) return byEmail;

  const digits = person.phone ? phoneKey(person.phone) : '';
  const byPhone =
    digits.length >= 10
      ? await inClub()
          .andWhere(`regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g') LIKE :suffix`, { suffix: `%${digits}` })
          .getOne()
      : null;
  if (byPhone && !byPhone.email) {
    byPhone.email = key;
    return repo.save(byPhone);
  }

  if (!person.firstName?.trim() || !person.lastName?.trim()) {
    throw new BadRequestException('First and last name are required');
  }
  return repo.save(
    repo.create({
      firstName: person.firstName.trim(),
      lastName: person.lastName.trim(),
      email: key,
      // The number already belongs to someone else in this club (phone is unique per club).
      phone: byPhone ? null : person.phone?.trim() || null,
      organizationId,
    }),
  );
}
