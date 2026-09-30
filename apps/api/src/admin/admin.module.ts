import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { UsersModule } from '../users/users.module';
import { GroupsModule } from '../groups/groups.module';
import { PlayersModule } from '../players/players.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    UsersModule,
    GroupsModule,
    PlayersModule,
    SessionsModule,
  ],
  controllers: [AdminController, PlatformController],
  providers: [AdminService, PlatformService],
})
export class AdminModule {}
