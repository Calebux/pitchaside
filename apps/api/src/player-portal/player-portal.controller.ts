import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEmail, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushSubscriptionDto, UnsubscribeDto } from '../notifications/notifications.controller';
import { CurrentPerson, Person, PlayerAuthGuard, PlayerAuthService } from './player-auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AllowTreasurer } from '../auth/decorators/allow-treasurer.decorator';
import { SkipCsrf } from '../auth/decorators/skip-csrf.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PlayerPortalService } from './player-portal.service';
import { setPlayerAuthCookies, clearPlayerAuthCookies, COOKIE_NAMES } from '../auth/cookie.util';
import { UsersService } from '../users/users.service';

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
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  @SkipCsrf()
  @Get('player-auth/mode')
  mode() {
    return { mode: this.auth.mode };
  }

  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.phone, dto.password);
    if ('needsPassword' in result) return result;
    const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(dto.phone));
    setPlayerAuthCookies(res, this.configService, result.token, refreshToken);
    return result;
  }

  /** First sign-in for players who don't have a password yet. */
  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('player-auth/set-password')
  async setPassword(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.setInitialPassword(dto.phone, dto.password);
    const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(dto.phone));
    setPlayerAuthCookies(res, this.configService, result.token, refreshToken);
    return result;
  }

  /** Forgot password: code from /player-auth/request-code, then a new password. */
  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.resetPassword(dto.phone, dto.code, dto.password);
    const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(dto.phone));
    setPlayerAuthCookies(res, this.configService, result.token, refreshToken);
    return result;
  }

  /** New player signing up from a group link: phone, name, optional email, password. */
  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/groups/:code/signup')
  async signup(@Param('code') code: string, @Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    await this.auth.createAccount(dto);
    const joined = await this.billing.joinGroup(code, {
      phone: dto.phone,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });
    const token = this.auth.issuePersonToken(dto.phone);
    const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(dto.phone));
    setPlayerAuthCookies(res, this.configService, token, refreshToken);
    return { ...joined, token };
  }

  /** Number-only sign-in (PLAYER_AUTH_MODE=phone). */
  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/phone')
  async signInWithPhone(@Body() dto: RequestCodeDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.signInWithPhone(dto.phone, dto.groupCode);
    if (result.token) {
      const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(dto.phone));
      setPlayerAuthCookies(res, this.configService, result.token, refreshToken);
    }
    return result;
  }

  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 6 } })
  @Post('player-auth/request-code')
  requestCode(@Body() dto: RequestCodeDto) {
    return this.auth.requestCode(dto.phone, dto.groupCode);
  }

  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('player-auth/verify')
  async verify(@Body() dto: VerifyCodeDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyCode(dto.phone, dto.code);
    if (result.token) {
      const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(dto.phone));
      setPlayerAuthCookies(res, this.configService, result.token, refreshToken);
    }
    return result;
  }

  /** Organiser → "Playing": swap a signed-in organiser (with a phone on file) for a player session. */
  @UseGuards(JwtAuthGuard)
  @AllowTreasurer()
  @Post('player-auth/from-organiser')
  async fromOrganiser(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    if (!user.phone) throw new BadRequestException('Add your phone number in Settings to switch to Playing.');
    await this.auth.ensureOrganiserPlayer(user);
    const token = this.auth.issuePersonToken(user.phone);
    const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(user.phone));
    setPlayerAuthCookies(res, this.configService, token, refreshToken);
    return { token };
  }

  /** New players (or returning ones without a session) joining via the group link. */
  @SkipCsrf()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/groups/:code/join')
  async join(@Param('code') code: string, @Body() dto: JoinWithProofDto, @Res({ passthrough: true }) res: Response) {
    const { phone } = this.auth.verifyPhoneProof(dto.phoneProof);
    const joined = await this.billing.joinGroup(code, {
      phone,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });
    const token = this.auth.issuePersonToken(phone);
    const refreshToken = await this.usersService.createRefreshToken(null, this.auth.getPhoneKey(phone));
    setPlayerAuthCookies(res, this.configService, token, refreshToken);
    return { ...joined, token };
  }

  // ── Player Refresh & Logout ──

  @SkipCsrf()
  @Post('player-auth/refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[COOKIE_NAMES.PLAYER_REFRESH];
    if (!rawRefreshToken) throw new BadRequestException('No refresh token');
    const result = await this.usersService.rotateRefreshToken(rawRefreshToken);
    if (!result || !result.phoneKey) throw new BadRequestException('Session expired');
    const account = await this.auth.accountForKey(result.phoneKey);
    if (!account) throw new BadRequestException('Account not found');
    const accessToken = this.auth.issuePersonToken(account.phone);
    setPlayerAuthCookies(res, this.configService, accessToken, result.newRawToken);
    return { ok: true };
  }

  @Post('player-auth/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[COOKIE_NAMES.PLAYER_REFRESH];
    if (rawRefreshToken) {
      await this.usersService.revokeRefreshToken(rawRefreshToken);
    }
    clearPlayerAuthCookies(res, this.configService);
    return { message: 'Logged out' };
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
