import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

export class LineupDto {
  /** 2–6 sides. */
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  teamCount?: number;

  /** playerId → 'A'…'F' | null */
  @IsOptional()
  @IsObject()
  teams?: Record<string, string | null>;
}

export class BalanceDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  teamCount?: number;
}

export class GameDto {
  @IsIn(['A', 'B', 'C', 'D', 'E', 'F'])
  teamA: string;

  @IsIn(['A', 'B', 'C', 'D', 'E', 'F'])
  teamB: string;

  @IsInt()
  @Min(0)
  @Max(99)
  scoreA: number;

  @IsInt()
  @Min(0)
  @Max(99)
  scoreB: number;
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
  balance(@Param('id') id: string, @Body() dto: BalanceDto, @CurrentUser() user: User) {
    return this.ratings.balanceTeams(id, user.organizationId, dto.teamCount);
  }

  @Post('sessions/:id/games')
  addGame(@Param('id') id: string, @Body() dto: GameDto, @CurrentUser() user: User) {
    return this.ratings.addGame(id, user.organizationId, dto);
  }

  @Delete('sessions/:id/games/:gameId')
  deleteGame(@Param('id') id: string, @Param('gameId') gameId: string, @CurrentUser() user: User) {
    return this.ratings.deleteGame(id, gameId, user.organizationId);
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

  /** Match-day summary for the shareable card image. */
  @Get(':token/card')
  card(@Param('token') token: string) {
    return this.ratings.getMatchCard(token);
  }
}
