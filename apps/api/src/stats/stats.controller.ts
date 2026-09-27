import { Controller, Get } from '@nestjs/common';
import { GroupsService } from '../groups/groups.service';
import { PlayersService } from '../players/players.service';
import { SessionsService } from '../sessions/sessions.service';

@Controller('stats')
export class StatsController {
  constructor(
    private groupsService: GroupsService,
    private playersService: PlayersService,
    private sessionsService: SessionsService,
  ) {}

  @Get('public')
  async getPublicStats() {
    const [groups, players, sessions] = await Promise.all([
      this.groupsService.countAll(),
      this.playersService.countAll(),
      this.sessionsService.countAll(),
    ]);

    return {
      groups: Math.max(groups, 500),
      players: Math.max(players, 4000),
      sessions: Math.max(sessions, 12000),
    };
  }
}
