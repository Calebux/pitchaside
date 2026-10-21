import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './entities/group.entity';
import { GroupMembership } from './entities/group-membership.entity';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { BillingModule } from '../billing/billing.module';
import { CryptoModule } from '../crypto/crypto.module';
import { RsvpModule } from '../rsvp/rsvp.module';

@Module({
  imports: [TypeOrmModule.forFeature([Group, GroupMembership]), BillingModule, CryptoModule, RsvpModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
