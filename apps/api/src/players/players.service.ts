import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player) private playersRepo: Repository<Player>,
  ) {}

  create(dto: CreatePlayerDto) {
    const player = this.playersRepo.create(dto);
    return this.playersRepo.save(player);
  }

  findAll() {
    return this.playersRepo.find();
  }

  async findOne(id: string) {
    const player = await this.playersRepo.findOne({
      where: { id },
      relations: ['memberships', 'memberships.group'],
    });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  async remove(id: string) {
    const result = await this.playersRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Player not found');
  }
}
