import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(PasswordReset) private resetRepo: Repository<PasswordReset>,
    @InjectRepository(RefreshToken) private refreshRepo: Repository<RefreshToken>,
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

  async updateProfile(userId: string, data: { firstName: string; lastName: string; phone?: string }) {
    const { phone, ...names } = data;
    await this.usersRepo.update(userId, phone === undefined ? names : { ...names, phone: phone.trim() || null });
    return this.findById(userId);
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.usersRepo.update(userId, { passwordHash });
  }

  async update2FASecret(userId: string, secret: string | null) {
    await this.usersRepo.update(userId, { twoFactorSecret: secret });
  }

  async enable2FA(userId: string) {
    await this.usersRepo.update(userId, { twoFactorEnabled: true });
  }

  async disable2FA(userId: string) {
    await this.usersRepo.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });
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

  // ── Refresh Tokens ──

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async createRefreshToken(userId: string | null, phoneKey: string | null): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const familyId = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId,
        phoneKey,
        tokenHash: this.hashToken(raw),
        expiresAt,
        familyId,
      }),
    );

    return raw;
  }

  async rotateRefreshToken(rawToken: string): Promise<{ newRawToken: string; userId: string | null; phoneKey: string | null } | null> {
    const hash = this.hashToken(rawToken);
    const existing = await this.refreshRepo.findOne({ where: { tokenHash: hash } });

    if (!existing) return null;

    // If already revoked, this is a replay attack — revoke the whole family
    if (existing.revoked) {
      await this.refreshRepo.update({ familyId: existing.familyId }, { revoked: true });
      return null;
    }

    // Check expiry
    if (existing.expiresAt < new Date()) {
      existing.revoked = true;
      await this.refreshRepo.save(existing);
      return null;
    }

    // Revoke old token
    existing.revoked = true;
    await this.refreshRepo.save(existing);

    // Issue new token in the same family
    const newRaw = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: existing.userId,
        phoneKey: existing.phoneKey,
        tokenHash: this.hashToken(newRaw),
        expiresAt,
        familyId: existing.familyId,
      }),
    );

    return { newRawToken: newRaw, userId: existing.userId, phoneKey: existing.phoneKey };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const hash = this.hashToken(rawToken);
    await this.refreshRepo.update({ tokenHash: hash }, { revoked: true });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshRepo.update({ userId, revoked: false }, { revoked: true });
  }

  async revokeAllPlayerRefreshTokens(phoneKey: string): Promise<void> {
    await this.refreshRepo.update({ phoneKey, revoked: false }, { revoked: true });
  }

  // ── Email Verification ──

  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await this.usersRepo.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: expiresAt,
    });
    return token;
  }

  async verifyEmail(token: string): Promise<User | null> {
    const user = await this.usersRepo.findOne({
      where: { emailVerificationToken: token },
      relations: ['organization'],
    });
    if (!user) return null;
    if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) return null;

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;
    return this.usersRepo.save(user);
  }
}
