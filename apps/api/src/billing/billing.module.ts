import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Session } from '../sessions/entities/session.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Player } from '../players/entities/player.entity';
import { PaymentsModule } from '../payments/payments.module';
import { BankTransfer } from './entities/bank-transfer.entity';
import { BillingService } from './billing.service';
import { BillingController, PublicBillingController } from './billing.controller';
import { PAYREP_CLIENT, PayrepClient } from './payrep/payrep.client';
import { MockPayrepClient } from './payrep/mock-payrep.client';
import { HttpPayrepClient } from './payrep/http-payrep.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, GroupMembership, Session, Payment, Player, BankTransfer]),
    PaymentsModule,
  ],
  controllers: [BillingController, PublicBillingController],
  providers: [
    BillingService,
    {
      provide: PAYREP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PayrepClient => {
        const webhookSecret = config.get('PAYREP_WEBHOOK_SECRET', 'dev-webhook-secret');
        if (config.get('PAYREP_MODE', 'mock') === 'live') {
          return new HttpPayrepClient({
            baseUrl: config.getOrThrow('PAYREP_BASE_URL'),
            apiKey: config.getOrThrow('PAYREP_API_KEY'),
            webhookSecret: config.getOrThrow('PAYREP_WEBHOOK_SECRET'),
          });
        }
        return new MockPayrepClient(webhookSecret);
      },
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
