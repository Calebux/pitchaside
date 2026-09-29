import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEmail, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushSubscriptionDto, UnsubscribeDto } from '../notifications/notifications.controller';
import { CurrentPerson, Person, PlayerAuthGuard, PlayerAuthService } from './player-auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AllowTreasurer } from '../auth/decorators/allow-treasurer.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
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

export class SignupDto {
  @Matches(PHONE, { message: 'Phone number format is invalid' })
  phone: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginDto {
  @Matches(PHONE, { message: 'Phone number format is invalid' })
  phone: string;

  @IsString()
  password: string;
}

export class ResetPasswordDto {
  @Matches(PHONE, { message: 'Phone number format is invalid' })
  phone: string;

  @Length(6, 6)
  code: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class UpdateNameDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;
}

export class StartGroupDto {
  @IsString()
  @MinLength(2)
  clubName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

/** Sign-in (phone or one-time code), and joining a group with a confirmed phone. */
@UseGuards(ThrottlerGuard)
@Controller()
export class PlayerAuthController {
  constructor(
    private readonly auth: PlayerAuthService,
    private readonly billing: BillingService,
  ) {}

  @Get('player-auth/mode')
  mode() {
    return { mode: this.auth.mode };
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.password);
  }

  /** First sign-in for players who don't have a password yet. */
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('player-auth/set-password')
  setPassword(@Body() dto: LoginDto) {
    return this.auth.setInitialPassword(dto.phone, dto.password);
  }

  /** Forgot password: code from /player-auth/request-code, then a new password. */
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.phone, dto.code, dto.password);
  }

  /** New player signing up from a group link: phone, name, optional email, password. */
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/groups/:code/signup')
  async signup(@Param('code') code: string, @Body() dto: SignupDto) {
    await this.auth.createAccount(dto);
    const joined = await this.billing.joinGroup(code, {
      phone: dto.phone,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });
    return { ...joined, token: this.auth.issuePersonToken(dto.phone) };
  }

  /** Number-only sign-in (PLAYER_AUTH_MODE=phone). */
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/phone')
  signInWithPhone(@Body() dto: RequestCodeDto) {
    return this.auth.signInWithPhone(dto.phone, dto.groupCode);
  }

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

  /** Organiser → "Playing": swap a signed-in organiser (with a phone on file) for a player session. */
  @UseGuards(JwtAuthGuard)
  @AllowTreasurer()
  @Post('player-auth/from-organiser')
  async fromOrganiser(@CurrentUser() user: User) {
    if (!user.phone) throw new BadRequestException('Add your phone number in Settings to switch to Playing.');
    await this.auth.ensureOrganiserPlayer(user);
    return { token: this.auth.issuePersonToken(user.phone) };
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
    return { ...joined, token: this.auth.issuePersonToken(phone) };
  }
}

/** The player app — everything behind a person sign-in. */
@UseGuards(PlayerAuthGuard)
@Controller('me')
export class PlayerPortalController {
  constructor(
    private readonly portal: PlayerPortalService,
    private readonly notifications: NotificationsService,
    private readonly playerAuth: PlayerAuthService,
  ) {}

  @Get()
  home(@CurrentPerson() person: Person) {
    return this.portal.home(person);
  }

  @Get('games')
  games(@CurrentPerson() person: Person) {
    return this.portal.games(person);
  }

  @Get('payments')
  payments(@CurrentPerson() person: Person) {
    return this.portal.payments(person);
  }

  @Get('profile')
  profile(@CurrentPerson() person: Person) {
    return this.portal.profile(person);
  }

  @Post('sessions/:id/rsvp')
  setRsvp(@Param('id') id: string, @Body() dto: RsvpDto, @CurrentPerson() person: Person) {
    return this.portal.setRsvp(person, id, dto.status);
  }

  @Post('groups/:code/join')
  join(@Param('code') code: string, @CurrentPerson() person: Person) {
    return this.portal.joinGroup(person, code);
  }

  @Get('votes/:token')
  myBallot(@Param('token') token: string, @CurrentPerson() person: Person) {
    return this.portal.myBallot(person, token);
  }

  @Post('votes/:token')
  vote(@Param('token') token: string, @Body() dto: VoteDto, @CurrentPerson() person: Person) {
    return this.portal.vote(person, token, dto.picks);
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @UseGuards(ThrottlerGuard)
  @Post('start-group')
  startGroup(@Body() dto: StartGroupDto, @CurrentPerson() person: Person) {
    return this.portal.startGroup(person, dto);
  }

  @Patch('account')
  updateName(@Body() dto: UpdateNameDto, @CurrentPerson() person: Person) {
    return this.playerAuth.updateName(person, dto.firstName, dto.lastName);
  }

  @Post('password')
  changePassword(@Body() dto: ChangePasswordDto, @CurrentPerson() person: Person) {
    return this.playerAuth.changePassword(person, dto.currentPassword ?? '', dto.newPassword);
  }

  @Post('push')
  subscribe(@Body() dto: PushSubscriptionDto, @CurrentPerson() person: Person) {
    return this.notifications.subscribe(dto, { playerId: person.players[0]?.id, phoneKey: person.key });
  }

  @Delete('push')
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.notifications.unsubscribe(dto.endpoint);
  }
}
