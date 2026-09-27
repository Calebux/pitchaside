import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment } from '../payments/entities/payment.entity';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private sessionsRepo: Repository<Session>,
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
  ) {}

  async create(dto: CreateSessionDto, organizationId: string) {
    const group = await this.groupsRepo.findOne({
      where: { id: dto.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    const session = this.sessionsRepo.create({
      groupId: dto.groupId,
      date: dto.date,
      targetAmount: group.targetPlayers * Number(group.feePerPlayer),
    });
    const saved = await this.sessionsRepo.save(session);

    // Auto-generate pending payments for all group members
    const memberships = await this.membershipsRepo.find({
      where: { groupId: dto.groupId },
    });

    if (memberships.length > 0) {
      const payments = memberships.map((m) =>
        this.paymentsRepo.create({
          sessionId: saved.id,
          playerId: m.playerId,
          amount: Number(group.feePerPlayer),
        }),
      );
      await this.paymentsRepo.save(payments);
    }

    return this.findOne(saved.id, organizationId);
  }

  async findAll(organizationId: string, groupId?: string) {
    const qb = this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('group.organizationId = :organizationId', { organizationId })
      .orderBy('session.date', 'DESC');

    if (groupId) {
      qb.andWhere('session.groupId = :groupId', { groupId });
    }

    return qb.getMany();
  }

  async findOne(id: string, organizationId: string) {
    const session = await this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.group', 'group')
      .leftJoinAndSelect('session.payments', 'payment')
      .leftJoinAndSelect('payment.player', 'player')
      .where('session.id = :id', { id })
      .andWhere('group.organizationId = :organizationId', { organizationId })
      .getOne();

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async updateStatus(id: string, status: string, organizationId: string) {
    const session = await this.findOne(id, organizationId);
    session.status = status as SessionStatus;
    return this.sessionsRepo.save(session);
  }

  async remove(id: string, organizationId: string) {
    const session = await this.findOne(id, organizationId);
    await this.sessionsRepo.remove(session);
  }

  async countByOrganization(organizationId: string) {
    return this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoin('session.group', 'group')
      .where('group.organizationId = :organizationId', { organizationId })
      .getCount();
  }

  async totalCollectedByOrganization(organizationId: string): Promise<number> {
    const result = await this.sessionsRepo
      .createQueryBuilder('session')
      .innerJoin('session.group', 'group')
      .select('COALESCE(SUM(session.collectedAmount), 0)', 'total')
      .where('group.organizationId = :organizationId', { organizationId })
      .getRawOne();
    return Number(result.total);
  }
}
