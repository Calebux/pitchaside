import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

export class LineupDto {
  /** playerId → 'bibs' | 'non_bibs' | null */
  @IsOptional()
  @IsObject()
  teams?: Record<string, 'bibs' | 'non_bibs' | null>;

  /** { bibs, nonBibs } or null to clear. */
  @IsOptional()
  score?: { bibs: number; nonBibs: number } | null;
}

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

  @Get('sessions/:id/lineup')
  lineup(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ratings.getLineup(id, user.organizationId);
  }

  @Put('sessions/:id/lineup')
  setLineup(@Param('id') id: string, @Body() dto: LineupDto, @CurrentUser() user: User) {
    return this.ratings.setLineup(id, user.organizationId, dto);
  }

  @Post('sessions/:id/lineup/balance')
  balance(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ratings.balanceTeams(id, user.organizationId);
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
