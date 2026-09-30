import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CONTRIBUTIONS_VISIBILITY, Group } from './entities/group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
    private billing: BillingService,
  ) {}

  async create(dto: CreateGroupDto, organizationId: string) {
    const group = await this.groupsRepo.save(this.groupsRepo.create({ ...dto, organizationId }));
    // Invite link, PulseMFB collection account and first dues period.
    return this.billing.setupGroup(group);
  }

  findAll(organizationId: string) {
    return this.groupsRepo.find({
      where: { organizationId },
      relations: ['memberships', 'memberships.player'],
    });
  }

  async findAllPaginated(
    organizationId: string,
    query: PaginationDto,
  ): Promise<PaginatedResult<Group>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.groupsRepo
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.memberships', 'membership')
      .leftJoinAndSelect('membership.player', 'player')
      .where('group.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere('group.name ILIKE :s', { s: `%${query.search}%` });
    }

    qb.orderBy('group.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const group = await this.groupsRepo.findOne({
      where: { id, organizationId },
      relations: ['memberships', 'memberships.player'],
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async update(id: string, dto: Partial<CreateGroupDto>, organizationId: string) {
    const group = await this.findOne(id, organizationId);
    // PATCH bodies are typed Partial<CreateGroupDto>, which the ValidationPipe can't see through.
    if (dto.contributionsVisibility !== undefined && !CONTRIBUTIONS_VISIBILITY.includes(dto.contributionsVisibility)) {
      throw new BadRequestException('contributionsVisibility must be private, totals or names');
    }
    Object.assign(group, dto);
    const saved = await this.groupsRepo.save(group);
    // Switching to a periodic type opens the current dues period straight away.
    await this.billing.ensureCurrentPeriod(saved);
    return saved;
  }

  async addMember(groupId: string, dto: AddMemberDto, organizationId: string) {
    await this.findOne(groupId, organizationId);
    const membership = await this.membershipsRepo.save(
      this.membershipsRepo.create({
        groupId,
        playerId: dto.playerId,
        role: dto.role,
      }),
    );
    await this.billing.onMemberAdded(membership);
    return membership;
  }

  async removeMember(groupId: string, playerId: string, organizationId: string) {
    await this.findOne(groupId, organizationId);
    const result = await this.membershipsRepo.delete({ groupId, playerId });
    if (result.affected === 0) throw new NotFoundException('Membership not found');
  }

  async remove(id: string, organizationId: string) {
    const group = await this.findOne(id, organizationId);
    await this.groupsRepo.remove(group);
  }

  countByOrganization(organizationId: string) {
    return this.groupsRepo.count({ where: { organizationId } });
  }

  countAll() {
    return this.groupsRepo.count();
  }
}
