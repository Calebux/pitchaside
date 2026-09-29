import {
  BadRequestException,
  CanActivate,
  ConflictException,
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
import * as bcrypt from 'bcrypt';
import { Player } from '../players/entities/player.entity';
import { Group } from '../groups/entities/group.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { phoneKey } from '../common/format.util';
import { PhoneOtp } from './entities/phone-otp.entity';
import { PlayerAccount } from './entities/player-account.entity';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 30 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

/** A person = a phone number. They may play for several clubs and/or organise one. */
interface PersonClaims {
  typ: 'person';
  key: string;
  phone: string;
}

/** Tokens issued before person accounts (one player record). Still accepted. */
interface LegacyPlayerClaims {
  typ: 'player';
  sub: string;
}

interface PhoneClaims {
  typ: 'phone';
  key: string;
  phone: string;
}

export interface Person {
  key: string;
  phone: string;
  /** Their player record in each club they play for. */
  players: Player[];
  firstName: string;
  lastName: string;
}

const PHONE_MATCH = `regexp_replace(p.phone, '\\D', '', 'g') LIKE :suffix`;

@Injectable()
export class PlayerAuthService {
  constructor(
    @InjectRepository(PhoneOtp) private otpRepo: Repository<PhoneOtp>,
    @InjectRepository(Player) private playersRepo: Repository<Player>,
    @InjectRepository(Group) private groupsRepo: Repository<Group>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(PlayerAccount) private accountsRepo: Repository<PlayerAccount>,
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

  /** Every player record (one per club) for this phone number, oldest first. */
  findPlayersByKey(key: string) {
    return this.playersRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.organization', 'org')
      .where(PHONE_MATCH, { suffix: `%${key}` })
      .orderBy('p.createdAt', 'ASC')
      .getMany();
  }

  /** Organiser accounts linked to this phone number. */
  findOrganisersByKey(key: string) {
    return this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.organization', 'org')
      .where(`regexp_replace(coalesce(u.phone, ''), '\\D', '', 'g') LIKE :suffix`, { suffix: `%${key}` })
      .getMany();
  }

  // ── Accounts & passwords ──

  /**
   * The person's account, created on the fly from their player record if an
   * organiser added them (or they joined before passwords existed).
   */
  async accountFor(key: string): Promise<PlayerAccount | null> {
    const existing = await this.accountsRepo.findOne({ where: { phoneKey: key } });
    if (existing) return existing;
    const players = await this.findPlayersByKey(key);
    const organisers = players.length ? [] : await this.findOrganisersByKey(key);
    const source = players[players.length - 1] ?? organisers[0];
    if (!source) return null;
    return this.accountsRepo.save(
      this.accountsRepo.create({
        phoneKey: key,
        phone: source.phone ?? '',
        firstName: source.firstName,
        lastName: source.lastName,
        email: players[players.length - 1]?.email ?? organisers[0]?.email ?? null,
        passwordHash: null,
      }),
    );
  }

  private validatePassword(password: string) {
    if (!password || password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
  }

  /** Brand-new person signing up through a group link. */
  async createAccount(input: { phone: string; firstName: string; lastName: string; email?: string; password: string }) {
    const key = phoneKey(input.phone);
    if (key.length < 10) throw new BadRequestException('Enter your full phone number');
    this.validatePassword(input.password);
    const existing = await this.accountFor(key);
    if (existing) {
      throw new ConflictException(
        existing.passwordHash
          ? 'You already have a PitchAside account — sign in instead.'
          : 'This number is already registered — sign in to set your password.',
      );
    }
    return this.accountsRepo.save(
      this.accountsRepo.create({
        phoneKey: key,
        phone: input.phone.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email?.trim() || null,
        passwordHash: await bcrypt.hash(input.password, 10),
      }),
    );
  }

  /** Phone + password. Accounts without a password yet get `needsPassword` instead of a token. */
  async login(phone: string, password: string) {
    const key = phoneKey(phone);
    if (key.length < 10) throw new BadRequestException('Enter your full phone number');
    const account = await this.accountFor(key);
    if (!account) {
      throw new NotFoundException("There's no PitchAside account with that number. Ask your organiser for your group link.");
    }
    if (!account.passwordHash) return { needsPassword: true as const, firstName: account.firstName };
    if (!(await bcrypt.compare(password ?? '', account.passwordHash))) {
      throw new UnauthorizedException('Wrong phone number or password');
    }
    return { token: this.issuePersonToken(account.phone || phone), firstName: account.firstName };
  }

  /** First sign-in for an existing player who has never had a password. */
  async setInitialPassword(phone: string, password: string) {
    this.validatePassword(password);
    const account = await this.accountFor(phoneKey(phone));
    if (!account) throw new NotFoundException("There's no PitchAside account with that number.");
    if (account.passwordHash) throw new BadRequestException('This account already has a password — sign in, or use “Forgot password”.');
    account.passwordHash = await bcrypt.hash(password, 10);
    await this.accountsRepo.save(account);
    return { token: this.issuePersonToken(account.phone || phone), firstName: account.firstName };
  }

  /** Forgot password: a one-time code (requestCode) then a new password. */
  async resetPassword(phone: string, code: string, password: string) {
    this.validatePassword(password);
    await this.verifyCode(phone, code);
    const account = await this.accountFor(phoneKey(phone));
    if (!account) throw new NotFoundException("There's no PitchAside account with that number.");
    account.passwordHash = await bcrypt.hash(password, 10);
    await this.accountsRepo.save(account);
    return { token: this.issuePersonToken(account.phone || phone), firstName: account.firstName };
  }

  async changePassword(person: Person, current: string, next: string) {
    this.validatePassword(next);
    const account = await this.accountFor(person.key);
    if (!account) throw new NotFoundException('Account not found');
    if (account.passwordHash && !(await bcrypt.compare(current ?? '', account.passwordHash))) {
      throw new UnauthorizedException('Your current password is wrong');
    }
    account.passwordHash = await bcrypt.hash(next, 10);
    await this.accountsRepo.save(account);
    return { ok: true };
  }

  /** Renames the person everywhere: their account and their player record in every club. */
  async updateName(person: Person, firstName: string, lastName: string) {
    const account = await this.accountFor(person.key);
    if (account) {
      account.firstName = firstName.trim();
      account.lastName = lastName.trim();
      await this.accountsRepo.save(account);
    }
    for (const p of person.players) {
      p.firstName = firstName.trim();
      p.lastName = lastName.trim();
    }
    if (person.players.length) await this.playersRepo.save(person.players);
    return { firstName: firstName.trim(), lastName: lastName.trim() };
  }

  /** Sign-in method players see: 'password' (default). Legacy: 'phone' (number only), 'otp'. */
  get mode(): 'password' | 'phone' | 'otp' {
    const m = this.config.get('PLAYER_AUTH_MODE', 'password');
    return m === 'phone' || m === 'otp' ? m : 'password';
  }

  /** Phone-only sign-in. Only allowed while PLAYER_AUTH_MODE=phone. */
  async signInWithPhone(phone: string, groupCode?: string) {
    if (this.mode !== 'phone') throw new UnauthorizedException('A confirmation code is required');
    const key = phoneKey(phone);
    if (key.length < 10) throw new BadRequestException('Enter your full phone number');
    await this.assertKnown(key, groupCode);
    return this.issueSignIn(phone, key);
  }

  private async assertKnown(key: string, groupCode?: string) {
    const [players, organisers] = await Promise.all([this.findPlayersByKey(key), this.findOrganisersByKey(key)]);
    const group = groupCode ? await this.groupsRepo.findOne({ where: { inviteCode: groupCode } }) : null;
    if (!players.length && !organisers.length && !group) {
      throw new NotFoundException("We couldn't find a player with that number. Ask your organiser for your group link.");
    }
    return { players, organisers, group };
  }

  async requestCode(phone: string, groupCode?: string) {
    const key = phoneKey(phone);
    if (key.length < 10) throw new BadRequestException('Enter your full phone number');
    const { players, group } = await this.assertKnown(key, groupCode);

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
      to: players[0]?.phone ?? phone,
      body: `${code} is your PitchAside code. It expires in 10 minutes — don't share it with anyone.`,
      kind: 'otp',
      playerId: players[0]?.id,
      organizationId: players[0]?.organizationId ?? group?.organizationId,
    });

    return {
      sent: true,
      isNewPlayer: players.length === 0,
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
    return this.issueSignIn(phone, key);
  }

  /**
   * phoneProof: short-lived "this number was confirmed" (used to create a new
   * player). token: the person's session, when they already exist anywhere.
   */
  private async issueSignIn(phone: string, key: string) {
    const [players, organisers] = await Promise.all([this.findPlayersByKey(key), this.findOrganisersByKey(key)]);
    const phoneProof = this.jwt.sign({ typ: 'phone', key, phone: phone.trim() } satisfies PhoneClaims, {
      secret: this.secret,
      expiresIn: '30m',
    });
    const known = players[0] ?? organisers[0];
    return {
      phoneProof,
      token: known ? this.issuePersonToken(phone) : undefined,
      player: known ? { id: players[0]?.id ?? '', firstName: known.firstName } : undefined,
    };
  }

  /** An organiser switching to Playing gets a player record in their own club (so they can join their own games). */
  async ensureOrganiserPlayer(user: User) {
    if (!user.phone) return null;
    const key = phoneKey(user.phone);
    const existing = await this.playersRepo
      .createQueryBuilder('p')
      .where('p.organizationId = :org', { org: user.organizationId })
      .andWhere(PHONE_MATCH, { suffix: `%${key}` })
      .getOne();
    if (existing) return existing;
    const emailTaken = await this.playersRepo.findOne({ where: { email: user.email, organizationId: user.organizationId } });
    return this.playersRepo.save(
      this.playersRepo.create({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: emailTaken ? undefined : user.email,
        organizationId: user.organizationId,
      }),
    );
  }

  issuePersonToken(phone: string) {
    return this.jwt.sign({ typ: 'person', key: phoneKey(phone), phone: phone.trim() } satisfies PersonClaims, {
      secret: this.secret,
      expiresIn: '90d',
    });
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

  async personFromToken(token: string): Promise<Person> {
    let claims: PersonClaims | LegacyPlayerClaims;
    try {
      claims = this.jwt.verify<PersonClaims | LegacyPlayerClaims>(token, { secret: this.secret });
    } catch {
      throw new UnauthorizedException('Please sign in again');
    }
    let key: string;
    let phone: string;
    if (claims.typ === 'person') {
      key = claims.key;
      phone = claims.phone;
    } else if (claims.typ === 'player') {
      const legacy = await this.playersRepo.findOne({ where: { id: claims.sub } });
      if (!legacy) throw new UnauthorizedException('Please sign in again');
      key = phoneKey(legacy.phone);
      phone = legacy.phone;
    } else {
      throw new UnauthorizedException('Please sign in again');
    }
    const players = await this.findPlayersByKey(key);
    const organisers = players.length ? [] : await this.findOrganisersByKey(key);
    if (!players.length && !organisers.length) throw new UnauthorizedException('Please sign in again');
    const account = await this.accountsRepo.findOne({ where: { phoneKey: key } });
    const named = account ?? players[players.length - 1] ?? organisers[0];
    return { key, phone, players, firstName: named.firstName, lastName: named.lastName };
  }
}

/** Requires `Authorization: Bearer <player token>`; puts the person on request.person. */
@Injectable()
export class PlayerAuthGuard implements CanActivate {
  constructor(private auth: PlayerAuthService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Please sign in');
    req.person = await this.auth.personFromToken(header.slice(7));
    return true;
  }
}

export const CurrentPerson = createParamDecorator((_: unknown, ctx: ExecutionContext): Person => {
  return ctx.switchToHttp().getRequest().person;
});
