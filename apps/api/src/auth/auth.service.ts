import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';
import { UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private orgsService: OrganizationsService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const organization = await this.orgsService.create(dto.organizationName);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
      role: UserRole.ORG_ADMIN,
      organizationId: organization.id,
    });

    const token = this.jwtService.sign({ sub: user.id });

    return {
      accessToken: token,
      user: this.sanitizeUser(user, organization),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ sub: user.id });

    return {
      accessToken: token,
      user: this.sanitizeUser(user, user.organization),
    };
  }

  getProfile(user: any) {
    return this.sanitizeUser(user, user.organization);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Always return success to avoid email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    const token = await this.usersService.createResetToken(user.id);
    await this.mailService.sendPasswordReset(
      user.email,
      user.firstName,
      token,
    );

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await this.usersService.findValidResetToken(token);
    if (!reset) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(reset.userId, passwordHash);
    await this.usersService.markResetTokenUsed(reset.id);

    return { message: 'Password has been reset successfully.' };
  }

  private sanitizeUser(user: any, organization?: any) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organization: organization
        ? { id: organization.id, name: organization.name, createdAt: organization.createdAt }
        : undefined,
      createdAt: user.createdAt,
    };
  }
}
