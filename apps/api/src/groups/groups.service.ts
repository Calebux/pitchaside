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

  create(dto: CreateGroupDto) {
    const group = this.groupsRepo.create(dto);
    return this.groupsRepo.save(group);
  }

  findAll() {
    return this.groupsRepo.find({ relations: ['memberships', 'memberships.player'] });
  }

  async findOne(id: string) {
    const group = await this.groupsRepo.findOne({
      where: { id },
      relations: ['memberships', 'memberships.player'],
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async addMember(groupId: string, dto: AddMemberDto) {
    await this.findOne(groupId);
    const membership = this.membershipsRepo.create({
      groupId,
      playerId: dto.playerId,
      role: dto.role,
    });
    return this.membershipsRepo.save(membership);
  }

  async removeMember(groupId: string, playerId: string) {
    const result = await this.membershipsRepo.delete({ groupId, playerId });
    if (result.affected === 0) throw new NotFoundException('Membership not found');
  }

  async remove(id: string) {
    const result = await this.groupsRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Group not found');
  }
}
