import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from '../players/entities/player.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Session } from '../sessions/entities/session.entity';
import { Payment } from '../payments/entities/payment.entity';
import { BillingModule } from '../billing/billing.module';
import { RatingsModule } from '../ratings/ratings.module';
import { RsvpModule } from '../rsvp/rsvp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PhoneOtp } from './entities/phone-otp.entity';
import { PlayerAuthGuard, PlayerAuthService } from './player-auth.service';
import { PlayerPortalService } from './player-portal.service';
import { PlayerAuthController, PlayerPortalController } from './player-portal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PhoneOtp, Player, Group, GroupMembership, Session, Payment]),
    JwtModule.register({}),
    BillingModule,
    RatingsModule,
    RsvpModule,
    NotificationsModule,
  ],
  controllers: [PlayerAuthController, PlayerPortalController],
  providers: [PlayerAuthService, PlayerAuthGuard, PlayerPortalService],
})
export class PlayerPortalModule {}
