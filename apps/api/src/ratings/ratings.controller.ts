import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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

  /** 'A'…'F' → playerId | null: who captains each side (they're moved onto it). */
  @IsOptional()
  @IsObject()
  captains?: Record<string, string | null>;
}

export class BalanceDto {
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  teamCount?: number;
}

export class GoalDto {
  @IsIn(['A', 'B', 'C', 'D', 'E', 'F'])
  team: string;

  @IsUUID()
  scorerId: string;

  @IsOptional()
  @IsUUID()
  assistId?: string | null;
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

  /** Who scored (and set up) each goal, when the organiser saw it. Fewer than the score is fine. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(198)
  @ValidateNested({ each: true })
  @Type(() => GoalDto)
  goals?: GoalDto[];
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
    return this.ratings.addGame(id, user.organizationId, dto, `${user.firstName} (organiser)`);
  }

  @Post('sessions/:id/games/:gameId/goals')
  addGoal(@Param('id') id: string, @Param('gameId') gameId: string, @Body() dto: GoalDto, @CurrentUser() user: User) {
    return this.ratings.addGoal(id, gameId, user.organizationId, dto, `${user.firstName} (organiser)`);
  }

  @Delete('sessions/:id/goals/:goalId')
  deleteGoal(@Param('id') id: string, @Param('goalId') goalId: string, @CurrentUser() user: User) {
    return this.ratings.deleteGoal(id, goalId, user.organizationId);
  }

  @Delete('sessions/:id/games/:gameId')
  deleteGame(@Param('id') id: string, @Param('gameId') gameId: string, @CurrentUser() user: User) {
    return this.ratings.deleteGame(id, gameId, user.organizationId);
  }

  /** The trial 40/40/20 rating beside the card's, for the organiser to compare. */
  @Get('groups/:id/rating-trial')
  ratingTrial(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ratings.getRatingTrial(id, user.organizationId);
  }

  @Get('groups/:id/table')
  groupTable(@Param('id') id: string, @Query('last') last: string | undefined, @CurrentUser() user: User) {
    // "Last 5 match days": any whole number from 1 to 52; anything else means the whole season.
    const n = Number(last);
    return this.ratings.getGroupTable(id, user.organizationId, Number.isInteger(n) && n >= 1 && n <= 52 ? n : undefined);
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
