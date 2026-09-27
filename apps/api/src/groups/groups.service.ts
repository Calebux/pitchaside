import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    @InjectRepository(GroupMembership) private membershipsRepo: Repository<GroupMembership>,
  ) {}

  create(dto: CreateGroupDto, organizationId: string) {
    const group = this.groupsRepo.create({ ...dto, organizationId });
    return this.groupsRepo.save(group);
  }

  findAll(organizationId: string) {
    return this.groupsRepo.find({
      where: { organizationId },
      relations: ['memberships', 'memberships.player'],
    });
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
    Object.assign(group, dto);
    return this.groupsRepo.save(group);
  }

  async addMember(groupId: string, dto: AddMemberDto, organizationId: string) {
    await this.findOne(groupId, organizationId);
    const membership = this.membershipsRepo.create({
      groupId,
      playerId: dto.playerId,
      role: dto.role,
    });
    return this.membershipsRepo.save(membership);
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
}
