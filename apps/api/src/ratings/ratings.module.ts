import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { Vote } from './entities/vote.entity';
import { RatingsService } from './ratings.service';
import { PublicRatingsController, RatingsController } from './ratings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vote, Session, Group])],
  controllers: [RatingsController, PublicRatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
