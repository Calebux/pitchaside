import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';
import { UserRole } from '../users/entities/user.entity';

jest.mock('bcrypt');

// Mock the @nestjs/jwt module to avoid ESM issues
const mockJwtSign = jest.fn().mockReturnValue('jwt-token');
jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {
    sign = mockJwtSign;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JwtService } = require('@nestjs/jwt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Record<string, jest.Mock>;
  let orgsService: Record<string, jest.Mock>;
  let mailService: Record<string, jest.Mock>;

  const mockOrg = { id: 'org-1', name: 'Test Org', createdAt: new Date() };
  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    passwordHash: 'hashed-pw',
    role: UserRole.ORG_ADMIN,
    organizationId: 'org-1',
    organization: mockOrg,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockJwtSign.mockClear().mockReturnValue('jwt-token');

    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      updatePassword: jest.fn(),
      findValidResetToken: jest.fn(),
      markResetTokenUsed: jest.fn(),
      createResetToken: jest.fn(),
    };
    orgsService = { create: jest.fn() };
    mailService = { sendPasswordReset: jest.fn(), sendPaymentReminder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: OrganizationsService, useValue: orgsService },
        { provide: JwtService, useValue: { sign: mockJwtSign } },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should create org + user and return token', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      orgsService.create.mockResolvedValue(mockOrg);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      usersService.create.mockResolvedValue(mockUser);

      const result = await service.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'password123',
        organizationName: 'Test Org',
      });

      expect(result.accessToken).toBe('jwt-token');
      expect((result as any).user.email).toBe('john@test.com');
      expect(orgsService.create).toHaveBeenCalledWith('Test Org');
      expect(usersService.create).toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          password: 'password123',
          organizationName: 'Test Org',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return token on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'john@test.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('jwt-token');
      expect((result as any).user.email).toBe('john@test.com');
    });

    it('should throw UnauthorizedException on invalid email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'john@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return requires2FA when 2FA is enabled', async () => {
      const user2FA = { ...mockUser, twoFactorEnabled: true };
      usersService.findByEmail.mockResolvedValue(user2FA);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'john@test.com',
        password: 'password123',
      });

      expect(result).toEqual({ requires2FA: true, userId: 'user-1' });
    });
  });

  describe('changePassword', () => {
    it('should throw when current password is wrong', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrong', 'newpass'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should succeed with correct current password', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed');

      const result = await service.changePassword('user-1', 'correct', 'newpass');

      expect(result.message).toContain('changed');
      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'new-hashed');
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException on invalid token', async () => {
      usersService.findValidResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reset password with valid token', async () => {
      const resetToken = { id: 'reset-1', userId: 'user-1', token: 'valid-token' };
      usersService.findValidResetToken.mockResolvedValue(resetToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed');

      const result = await service.resetPassword('valid-token', 'newpass');

      expect(result.message).toContain('reset');
      expect(usersService.updatePassword).toHaveBeenCalledWith('user-1', 'new-hashed');
      expect(usersService.markResetTokenUsed).toHaveBeenCalledWith('reset-1');
    });
  });
});
