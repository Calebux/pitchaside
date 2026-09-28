import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { createHash, randomInt } from 'crypto';
import { Player } from '../players/entities/player.entity';
import { Group } from '../groups/entities/group.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { phoneKey } from '../common/format.util';
import { PhoneOtp } from './entities/phone-otp.entity';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 30 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

interface PlayerClaims {
  typ: 'player';
  sub: string;
}

interface PhoneClaims {
  typ: 'phone';
  key: string;
  phone: string;
}

@Injectable()
export class PlayerAuthService {
  constructor(
    @InjectRepository(PhoneOtp) private otpRepo: Repository<PhoneOtp>,
    @InjectRepository(Player) private playersRepo: Repository<Player>,
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    private jwt: JwtService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {}

  /** Player tokens use their own secret so they can never pass as organiser tokens. */
  private get secret() {
    return `${this.config.get('JWT_SECRET', 'pitchaside-dev-secret')}:player`;
  }

  private hash(code: string, key: string) {
    return createHash('sha256').update(`${code}:${key}:${this.secret}`).digest('hex');
  }

  findPlayerByPhone(phone: string) {
    const key = phoneKey(phone);
    return this.playersRepo
      .createQueryBuilder('p')
      .where(`regexp_replace(p.phone, '\\D', '', 'g') LIKE :suffix`, { suffix: `%${key}` })
      .getOne();
  }

  async requestCode(phone: string, groupCode?: string) {
    const key = phoneKey(phone);
    if (key.length < 10) throw new BadRequestException('Enter your full phone number');

    const player = await this.findPlayerByPhone(phone);
    const group = groupCode ? await this.groupsRepo.findOne({ where: { inviteCode: groupCode } }) : null;
    if (!player && !group) {
      throw new NotFoundException("We couldn't find a player with that number. Ask your organiser for your group link.");
    }

    const recent = await this.otpRepo.find({
      where: { phoneKey: key, createdAt: MoreThan(new Date(Date.now() - 60 * 60 * 1000)) },
      order: { createdAt: 'DESC' },
    });
    if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_AFTER_MS) {
      throw new HttpException('Please wait a few seconds before asking for another code', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= MAX_CODES_PER_HOUR) {
      throw new HttpException('Too many codes requested — try again in an hour', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(100000, 1000000));
    await this.otpRepo.save(
      this.otpRepo.create({ phoneKey: key, codeHash: this.hash(code, key), expiresAt: new Date(Date.now() + CODE_TTL_MS) }),
    );
    await this.notifications.sendMessage({
      to: player?.phone ?? phone,
      body: `${code} is your PitchAside code. It expires in 10 minutes — don't share it with anyone.`,
      kind: 'otp',
      playerId: player?.id,
      organizationId: player?.organizationId ?? group?.organizationId,
    });

    return {
      sent: true,
      isNewPlayer: !player,
      // Mock messaging only: surface the code so the flow can be tested without a phone.
      devCode: this.notifications.messagingMode === 'mock' ? code : undefined,
    };
  }

  async verifyCode(phone: string, code: string) {
    const key = phoneKey(phone);
    const otp = await this.otpRepo.findOne({
      where: { phoneKey: key, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!otp || otp.attempts >= MAX_ATTEMPTS) throw new UnauthorizedException('That code has expired — request a new one');
    if (otp.codeHash !== this.hash(code.trim(), key)) {
      otp.attempts += 1;
      await this.otpRepo.save(otp);
      throw new UnauthorizedException('Wrong code — check the message and try again');
    }
    otp.usedAt = new Date();
    await this.otpRepo.save(otp);

    const player = await this.findPlayerByPhone(phone);
    const phoneProof = this.jwt.sign({ typ: 'phone', key, phone: phone.trim() } satisfies PhoneClaims, {
      secret: this.secret,
      expiresIn: '30m',
    });
    return {
      phoneProof,
      token: player ? this.issuePlayerToken(player.id) : undefined,
      player: player ? { id: player.id, firstName: player.firstName } : undefined,
    };
  }

  issuePlayerToken(playerId: string) {
    return this.jwt.sign({ typ: 'player', sub: playerId } satisfies PlayerClaims, { secret: this.secret, expiresIn: '90d' });
  }

  verifyPhoneProof(proof: string) {
    try {
      const claims = this.jwt.verify<PhoneClaims>(proof, { secret: this.secret });
      if (claims.typ !== 'phone') throw new Error('wrong token type');
      return claims;
    } catch {
      throw new UnauthorizedException('Phone verification expired — please confirm your number again');
    }
  }

  async playerFromToken(token: string) {
    let claims: PlayerClaims;
    try {
      claims = this.jwt.verify<PlayerClaims>(token, { secret: this.secret });
    } catch {
      throw new UnauthorizedException('Please sign in again');
    }
    if (claims.typ !== 'player') throw new UnauthorizedException('Please sign in again');
    const player = await this.playersRepo.findOne({ where: { id: claims.sub } });
    if (!player) throw new UnauthorizedException('Please sign in again');
    return player;
  }
}

/** Requires `Authorization: Bearer <player token>`; puts the player on request.player. */
@Injectable()
export class PlayerAuthGuard implements CanActivate {
  constructor(private auth: PlayerAuthService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Please sign in');
    req.player = await this.auth.playerFromToken(header.slice(7));
    return true;
  }
}

export const CurrentPlayer = createParamDecorator((_: unknown, ctx: ExecutionContext): Player => {
  return ctx.switchToHttp().getRequest().player;
});
