import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
  ) {}

  // ── Super Admin endpoints ──

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('organizations')
  @Roles(UserRole.SUPER_ADMIN)
  getAllOrganizations() {
    return this.adminService.getAllOrganizations();
  }

  @Get('organizations/:id')
  @Roles(UserRole.SUPER_ADMIN)
  getOrganization(@Param('id') id: string) {
    return this.adminService.getOrganization(id);
  }

  @Get('users')
  @Roles(UserRole.SUPER_ADMIN)
  getAllUsers() {
    return this.adminService.getAllUsers();
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
    return this.usersService.create({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      passwordHash,
      role: UserRole.MEMBER,
      organizationId: user.organizationId,
    });
  }
}
