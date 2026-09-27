import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

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

  async findAllPaginated(query: PaginationDto): Promise<PaginatedResult<Organization>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = {};
    if (query.search) {
      where.name = ILike(`%${query.search}%`);
    }

    const [data, total] = await this.orgsRepo.findAndCount({
      where,
      relations: ['users', 'groups'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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
