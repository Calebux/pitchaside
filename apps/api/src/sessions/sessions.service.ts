import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
  ) {}

  async create(dto: CreateSessionDto) {
    const group = await this.groupsRepo.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const session = this.sessionsRepo.create({
      groupId: dto.groupId,
      date: dto.date,
      targetAmount: group.targetPlayers * Number(group.feePerPlayer),
    });
    return this.sessionsRepo.save(session);
  }

  findAll(groupId?: string) {
    const where = groupId ? { groupId } : {};
    return this.sessionsRepo.find({
      where,
      relations: ['payments', 'payments.player'],
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string) {
    const session = await this.sessionsRepo.findOne({
      where: { id },
      relations: ['group', 'payments', 'payments.player'],
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async remove(id: string) {
    const result = await this.sessionsRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Session not found');
  }
}
