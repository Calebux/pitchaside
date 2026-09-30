import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GroupsService } from '../groups/groups.service';
import { PlayersService } from '../players/players.service';
import { SessionsService } from '../sessions/sessions.service';

/** A club's own admin page. Cross-club reporting is in PlatformService. */
@Injectable()
export class AdminService {
  constructor(
    private usersService: UsersService,
    private groupsService: GroupsService,
    private playersService: PlayersService,
    private sessionsService: SessionsService,
  ) {}

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
