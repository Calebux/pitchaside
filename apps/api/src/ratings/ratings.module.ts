import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { Group } from '../groups/entities/group.entity';
import { Vote } from './entities/vote.entity';
import { SessionGame } from './entities/session-game.entity';
import { MatchGoal } from './entities/match-goal.entity';
import { MatchEvent } from './entities/match-event.entity';
import { RatingsService } from './ratings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PublicPlayerCardController, PublicRatingsController, PublicTableController, RatingsController } from './ratings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vote, SessionGame, MatchGoal, Session, Group, MatchEvent]), NotificationsModule],
  controllers: [RatingsController, PublicRatingsController, PublicTableController, PublicPlayerCardController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
