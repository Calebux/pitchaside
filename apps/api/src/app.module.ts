import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsModule } from './groups/groups.module';
import { PlayersModule } from './players/players.module';
import { SessionsModule } from './sessions/sessions.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'pitchaside'),
        autoLoadEntities: true,
        synchronize: true, // disable in production
      }),
    }),
    GroupsModule,
    PlayersModule,
    SessionsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
