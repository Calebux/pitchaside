import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) private orgsRepo: Repository<Organization>,
  ) {}

  create(name: string) {
    const org = this.orgsRepo.create({ name });
    return this.orgsRepo.save(org);
  }

  findAll() {
    return this.orgsRepo.find();
  }

  async findOne(id: string) {
    const org = await this.orgsRepo.findOne({
      where: { id },
      relations: ['users', 'groups'],
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  count() {
    return this.orgsRepo.count();
  }
}
