import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEmail, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { Player } from '../players/entities/player.entity';
import { BillingService } from '../billing/billing.service';
import { RatingsService } from '../ratings/ratings.service';
import { RsvpService } from '../rsvp/rsvp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushSubscriptionDto, UnsubscribeDto } from '../notifications/notifications.controller';
import { CurrentPlayer, PlayerAuthGuard, PlayerAuthService } from './player-auth.service';
import { PlayerPortalService } from './player-portal.service';

const PHONE = /^[+\d][\d\s\-().]{6,}$/;

export class RequestCodeDto {
  @Matches(PHONE, { message: 'Phone number format is invalid' })
  phone: string;

  /** Group link code, when a brand-new player is joining. */
  @IsOptional()
  @IsString()
  groupCode?: string;
}

export class VerifyCodeDto {
  @Matches(PHONE, { message: 'Phone number format is invalid' })
  phone: string;

  @Length(6, 6)
  code: string;
}

export class JoinWithProofDto {
  @IsString()
  @IsNotEmpty()
  phoneProof: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class RsvpDto {
  @IsIn(['in', 'out'])
  status: 'in' | 'out';
}

export class VoteDto {
  @IsObject()
  picks: Record<string, string>;
}

/** Sign-in by one-time code, and joining a group with a verified phone. */
@UseGuards(ThrottlerGuard)
@Controller()
export class PlayerAuthController {
  constructor(
    private readonly auth: PlayerAuthService,
    private readonly billing: BillingService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 6 } })
  @Post('player-auth/request-code')
  requestCode(@Body() dto: RequestCodeDto) {
    return this.auth.requestCode(dto.phone, dto.groupCode);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/verify')
  verify(@Body() dto: VerifyCodeDto) {
    return this.auth.verifyCode(dto.phone, dto.code);
  }

  /** New players (or returning ones without a session) joining via the group link. */
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/groups/:code/join')
  async join(@Param('code') code: string, @Body() dto: JoinWithProofDto) {
    const { phone } = this.auth.verifyPhoneProof(dto.phoneProof);
    const joined = await this.billing.joinGroup(code, {
      phone,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });
    return { ...joined, token: this.auth.issuePlayerToken(joined.playerId) };
  }
}

/** Everything behind a player sign-in. */
@UseGuards(PlayerAuthGuard)
@Controller('me')
export class PlayerPortalController {
  constructor(
    private readonly portal: PlayerPortalService,
    private readonly billing: BillingService,
    private readonly ratings: RatingsService,
    private readonly rsvp: RsvpService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  home(@CurrentPlayer() player: Player) {
    return this.portal.home(player);
  }

  @Post('sessions/:id/rsvp')
  setRsvp(@Param('id') id: string, @Body() dto: RsvpDto, @CurrentPlayer() player: Player) {
    return this.rsvp.setByPlayer(id, player.id, dto.status);
  }

  @Post('groups/:code/join')
  join(@Param('code') code: string, @CurrentPlayer() player: Player) {
    return this.billing.joinGroupAsPlayer(code, player.id);
  }

  @Get('votes/:token')
  myBallot(@Param('token') token: string, @CurrentPlayer() player: Player) {
    return this.ratings.myBallot(token, player.id);
  }

  @Post('votes/:token')
  vote(@Param('token') token: string, @Body() dto: VoteDto, @CurrentPlayer() player: Player) {
    return this.ratings.submitVotes(token, player.id, dto.picks);
  }

  @Post('push')
  subscribe(@Body() dto: PushSubscriptionDto, @CurrentPlayer() player: Player) {
    return this.notifications.subscribe(dto, { playerId: player.id });
  }

  @Delete('push')
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.notifications.unsubscribe(dto.endpoint);
  }
}
