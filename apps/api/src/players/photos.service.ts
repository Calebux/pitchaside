import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Player } from './entities/player.entity';
import { PlayerPhoto } from './entities/player-photo.entity';
import { parsePhoto } from './photos';

/** Player photos: set (by the organiser for one player, or by a player for all their clubs), removed, served. */
@Injectable()
export class PhotosService {
  constructor(
    @InjectRepository(Player) private playersRepo: Repository<Player>,
    @InjectRepository(PlayerPhoto) private photosRepo: Repository<PlayerPhoto>,
  ) {}

  /** Puts the photo on these player records (a player is one record per club), replacing any old one. */
  async set(playerIds: string[], dataUrl: unknown) {
    const { data, mime } = parsePhoto(dataUrl);
    const key = randomBytes(16).toString('hex');
    const before = await this.playersRepo.find({ where: { id: In(playerIds) }, select: ['id', 'photoKey'] });
    await this.playersRepo.manager.transaction(async (tx) => {
      await tx.insert(PlayerPhoto, { key, data, mime });
      await tx.update(Player, { id: In(playerIds) }, { photoKey: key });
    });
    await this.dropUnused(before.map((p) => p.photoKey));
    return { photoKey: key };
  }

  async remove(playerIds: string[]) {
    const before = await this.playersRepo.find({ where: { id: In(playerIds) }, select: ['id', 'photoKey'] });
    await this.playersRepo.update({ id: In(playerIds) }, { photoKey: null });
    await this.dropUnused(before.map((p) => p.photoKey));
    return { photoKey: null };
  }

  async get(key: string) {
    const photo = /^[a-f0-9]{32}$/.test(key) ? await this.photosRepo.findOne({ where: { key } }) : null;
    if (!photo) throw new NotFoundException('No photo here');
    return photo;
  }

  /** Old photos no player points at any more are deleted, so replaced ones don't pile up. */
  private async dropUnused(keys: (string | null)[]) {
    const old = [...new Set(keys.filter((k): k is string => !!k))];
    if (!old.length) return;
    const still = await this.playersRepo.find({ where: { photoKey: In(old) }, select: ['id', 'photoKey'] });
    const used = new Set(still.map((p) => p.photoKey));
    const gone = old.filter((k) => !used.has(k));
    if (gone.length) await this.photosRepo.delete({ key: In(gone) });
  }
}
