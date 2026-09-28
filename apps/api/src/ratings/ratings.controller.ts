import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/** Organiser views: vote link + results per game, league table, player ratings. */
@UseGuards(JwtAuthGuard)
@Controller()
export class RatingsController {
  constructor(
    private readonly ratings: RatingsService,
    private readonly config: ConfigService,
  ) {}

  @Get('sessions/:id/voting')
  async sessionVoting(@Param('id') id: string, @CurrentUser() user: User) {
    const voting = await this.ratings.getSessionVoting(id, user.organizationId);
    return { ...voting, link: `${this.config.get('APP_URL', 'http://localhost:3000')}/v/${voting.token}` };
  }

  @Get('groups/:id/table')
  groupTable(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ratings.getGroupTable(id, user.organizationId);
  }

  @Get('players/:id/ratings')
  playerRatings(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ratings.getPlayerRatings(id, user.organizationId);
  }
}

/** The post-match ballot players open from WhatsApp — no account needed. */
@UseGuards(ThrottlerGuard)
@Controller('public/votes')
export class PublicRatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Get(':token')
  ballot(@Param('token') token: string) {
    return this.ratings.getBallot(token);
  }

  @Get(':token/results')
  results(@Param('token') token: string) {
    return this.ratings.getPublicResults(token);
  }
}
