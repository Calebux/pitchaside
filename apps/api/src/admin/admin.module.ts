import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { GroupsModule } from '../groups/groups.module';
import { PlayersModule } from '../players/players.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    OrganizationsModule,
    UsersModule,
    GroupsModule,
    PlayersModule,
    SessionsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
