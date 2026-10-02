import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GroupsService } from '../groups/groups.service';
import { PlayersService } from '../players/players.service';
import { SessionsService } from '../sessions/sessions.service';
import { BillingService } from '../billing/billing.service';

/** A club's own admin page. Cross-club reporting is in PlatformService. */
@Injectable()
export class AdminService {
  constructor(
    private usersService: UsersService,
    private groupsService: GroupsService,
    private playersService: PlayersService,
    private sessionsService: SessionsService,
    private billingService: BillingService,
  ) {}

  async getOrgStats(organizationId: string) {
    const [totalGroups, totalPlayers, totalSessions, totalCollected, totalReceived] =
      await Promise.all([
        this.groupsService.countByOrganization(organizationId),
        this.playersService.countByOrganization(organizationId),
        this.sessionsService.countByOrganization(organizationId),
        this.sessionsService.totalCollectedByOrganization(organizationId),
        this.billingService.totalReceivedByOrganization(organizationId),
      ]);
    // Collected is dues marked paid; received is every transfer into the club's accounts,
    // including money not yet matched to a player or sitting as credit.
    return { totalGroups, totalPlayers, totalSessions, totalCollected, totalReceived };
  }

  getOrgMembers(organizationId: string) {
    return this.usersService.findByOrganization(organizationId);
  }
}
