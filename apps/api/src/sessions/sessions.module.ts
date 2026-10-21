import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { RsvpModule } from '../rsvp/rsvp.module';
import { RatingsModule } from '../ratings/ratings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReminderLog } from '../reminders/entities/reminder-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Group, GroupMembership, Payment, ReminderLog]),
    RsvpModule,
    RatingsModule,
    NotificationsModule,
    BillingModule,
    PaymentsModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
