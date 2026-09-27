import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(PasswordReset) private resetRepo: Repository<PasswordReset>,
  ) {}

  create(data: Partial<User>) {
    const user = this.usersRepo.create(data);
    return this.usersRepo.save(user);
  }

  findByEmail(email: string) {
    return this.usersRepo.findOne({
      where: { email },
      relations: ['organization'],
    });
  }

  findById(id: string) {
    return this.usersRepo.findOne({
      where: { id },
      relations: ['organization'],
    });
  }

  findByOrganization(organizationId: string) {
    return this.usersRepo.find({ where: { organizationId } });
  }

  findAll() {
    return this.usersRepo.find({ relations: ['organization'] });
  }

  async findAllPaginated(query: PaginationDto): Promise<PaginatedResult<User>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization');

    if (query.search) {
      qb.where(
        '(user.firstName ILIKE :s OR user.lastName ILIKE :s OR user.email ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  count() {
    return this.usersRepo.count();
  }

  countByOrganization(organizationId: string) {
    return this.usersRepo.count({ where: { organizationId } });
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.usersRepo.update(userId, { passwordHash });
  }

  // ── Password Reset Tokens ──

  async createResetToken(userId: string): Promise<string> {
    // Invalidate any existing tokens
    await this.resetRepo.update(
      { userId, used: false },
      { used: true },
    );

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.resetRepo.save(
      this.resetRepo.create({ userId, token, expiresAt }),
    );

    return token;
  }

  async findValidResetToken(token: string) {
    const reset = await this.resetRepo.findOne({
      where: { token, used: false },
      relations: ['user'],
    });
    if (!reset) return null;
    if (reset.expiresAt < new Date()) return null;
    return reset;
  }

  async markResetTokenUsed(id: string) {
    await this.resetRepo.update(id, { used: true });
  }
}
