import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Rsvp } from './entities/rsvp.entity';
import { RsvpService } from './rsvp.service';
import { RsvpController } from './rsvp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Rsvp, Session, Group, GroupMembership, Payment]), PaymentsModule, NotificationsModule],
  controllers: [RsvpController],
  providers: [RsvpService],
  exports: [RsvpService],
})
export class RsvpModule {}
