import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { GroupsModule } from '../groups/groups.module';
import { PlayersModule } from '../players/players.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [GroupsModule, PlayersModule, SessionsModule],
  controllers: [StatsController],
})
export class StatsModule {}
