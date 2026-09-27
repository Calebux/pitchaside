import { Injectable } from '@nestjs/common';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';
import { GroupsService } from '../groups/groups.service';
import { PlayersService } from '../players/players.service';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class AdminService {
  constructor(
    private orgsService: OrganizationsService,
    private usersService: UsersService,
    private groupsService: GroupsService,
    private playersService: PlayersService,
    private sessionsService: SessionsService,
  ) {}

  // ── Super Admin ──

  async getPlatformStats() {
    const [totalOrgs, totalUsers] = await Promise.all([
      this.orgsService.count(),
      this.usersService.count(),
    ]);
    return { totalOrgs, totalUsers };
  }

  getAllOrganizations() {
    return this.orgsService.findAll();
  }

  getOrganization(id: string) {
    return this.orgsService.findOne(id);
  }

  getAllUsers() {
    return this.usersService.findAll();
  }

  // ── Org Admin ──

  async getOrgStats(organizationId: string) {
    const [totalGroups, totalPlayers, totalSessions, totalCollected] =
      await Promise.all([
        this.groupsService.countByOrganization(organizationId),
        this.playersService.countByOrganization(organizationId),
        this.sessionsService.countByOrganization(organizationId),
        this.sessionsService.totalCollectedByOrganization(organizationId),
      ]);
    return { totalGroups, totalPlayers, totalSessions, totalCollected };
  }

  getOrgMembers(organizationId: string) {
    return this.usersService.findByOrganization(organizationId);
  }
}
