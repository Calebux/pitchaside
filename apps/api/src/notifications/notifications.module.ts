import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from '../players/entities/player.entity';
import { User } from '../users/entities/user.entity';
import { OutboundMessage } from './entities/outbound-message.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import {
  MESSAGING_PROVIDER,
  MessagingProvider,
  MockMessagingProvider,
  TermiiMessagingProvider,
} from './providers/messaging.provider';

@Module({
  imports: [TypeOrmModule.forFeature([OutboundMessage, PushSubscriptionEntity, Player, User])],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: MESSAGING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MessagingProvider =>
        config.get('MESSAGING_MODE', 'mock') === 'live'
          ? new TermiiMessagingProvider(config.getOrThrow('TERMII_API_KEY'), config.get('TERMII_SENDER_ID', 'PitchAside'))
          : new MockMessagingProvider(),
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
