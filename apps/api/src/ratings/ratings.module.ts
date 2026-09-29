import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { Vote } from './entities/vote.entity';
import { SessionGame } from './entities/session-game.entity';
import { RatingsService } from './ratings.service';
import { PublicRatingsController, RatingsController } from './ratings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vote, SessionGame, Session, Group])],
  controllers: [RatingsController, PublicRatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
