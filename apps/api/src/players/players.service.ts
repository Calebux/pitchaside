import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entities/player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player) private playersRepo: Repository<Player>,
  ) {}

  create(dto: CreatePlayerDto, organizationId: string) {
    const player = this.playersRepo.create({ ...dto, organizationId });
    return this.playersRepo.save(player);
  }

  findAll(organizationId: string) {
    return this.playersRepo.find({ where: { organizationId } });
  }

  async findAllPaginated(
    organizationId: string,
    query: PaginationDto,
  ): Promise<PaginatedResult<Player>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.playersRepo
      .createQueryBuilder('player')
      .where('player.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere(
        '(player.firstName ILIKE :s OR player.lastName ILIKE :s OR player.phone ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('player.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const player = await this.playersRepo.findOne({
      where: { id, organizationId },
      relations: ['memberships', 'memberships.group'],
    });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  async update(id: string, dto: Partial<CreatePlayerDto>, organizationId: string) {
    const player = await this.findOne(id, organizationId);
    Object.assign(player, dto);
    return this.playersRepo.save(player);
  }

  async remove(id: string, organizationId: string) {
    const player = await this.findOne(id, organizationId);
    await this.playersRepo.remove(player);
  }

  countByOrganization(organizationId: string) {
    return this.playersRepo.count({ where: { organizationId } });
  }
}
