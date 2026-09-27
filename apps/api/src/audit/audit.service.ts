import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    userId: string;
    organizationId: string;
    metadata?: Record<string, any>;
  }) {
    const entry = this.auditRepo.create(data);
    return this.auditRepo.save(entry);
  }

  async findByOrganization(
    organizationId: string,
    query: PaginationDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.auditRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
