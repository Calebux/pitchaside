import { Controller, Get, Param, Post, Body, UseGuards, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcrypt';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  // ── Super Admin endpoints ──

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('organizations')
  @Roles(UserRole.SUPER_ADMIN)
  getAllOrganizations(@Query() query: PaginationDto) {
    return this.adminService.getAllOrganizations(query);
  }

  @Get('organizations/:id')
  @Roles(UserRole.SUPER_ADMIN)
  getOrganization(@Param('id') id: string) {
    return this.adminService.getOrganization(id);
  }

  @Get('users')
  @Roles(UserRole.SUPER_ADMIN)
  getAllUsers(@Query() query: PaginationDto) {
    return this.adminService.getAllUsers(query);
  }

  // ── Org Admin endpoints ──

  @Get('org/stats')
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  getOrgStats(@CurrentUser() user: User) {
    return this.adminService.getOrgStats(user.organizationId);
  }

  @Get('org/members')
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  getOrgMembers(@CurrentUser() user: User) {
    return this.adminService.getOrgMembers(user.organizationId);
  }

  @Post('org/members')
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  async addOrgMember(
    @CurrentUser() user: User,
    @Body() body: { firstName: string; lastName: string; email: string; password: string },
  ) {
    const passwordHash = await bcrypt.hash(body.password, 10);
    const newUser = await this.usersService.create({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      passwordHash,
      role: UserRole.MEMBER,
      organizationId: user.organizationId,
    });

    // Send invite email
    const orgName = user.organization?.name || 'your organization';
    await this.mailService.sendMemberInvite(
      body.email,
      body.firstName,
      orgName,
      body.password,
    );

    return newUser;
  }

  @Get('org/audit-log')
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  getAuditLog(@CurrentUser() user: User, @Query() query: PaginationDto) {
    return this.auditService.findByOrganization(user.organizationId, query);
  }
}
