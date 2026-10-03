import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SessionsService } from './sessions.service';
import { MatchClockService } from './match-clock.service';
import { SessionsController } from './sessions.controller';
import { RsvpModule } from '../rsvp/rsvp.module';
import { RatingsModule } from '../ratings/ratings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Group, GroupMembership, Payment]),
    RsvpModule,
    RatingsModule,
    NotificationsModule,
    BillingModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService, MatchClockService],
  exports: [SessionsService],
})
export class SessionsModule {}
