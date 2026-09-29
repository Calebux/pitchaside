import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { Payment } from '../payments/entities/payment.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Vote } from '../ratings/entities/vote.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { RsvpModule } from '../rsvp/rsvp.module';
import { RatingsModule } from '../ratings/ratings.module';
import { ReminderLog } from './entities/reminder-log.entity';
import { RemindersService } from './reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReminderLog, Session, Payment, GroupMembership, Vote]),
    NotificationsModule,
    RsvpModule,
    RatingsModule,
  ],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
