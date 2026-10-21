import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '../groups/entities/group.entity';
import { GroupMembership } from '../groups/entities/group-membership.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Player } from '../players/entities/player.entity';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { GroupWallet } from './entities/group-wallet.entity';
import { CryptoTransfer } from './entities/crypto-transfer.entity';
import { CryptoOutgoingTransfer } from './entities/crypto-outgoing-transfer.entity';
import { WalletDerivationCounter } from './entities/wallet-derivation-counter.entity';
import { CryptoService } from './crypto.service';
import { CryptoController } from './crypto.controller';
import { WebhookController } from './monitoring/webhook.controller';
import { MonitorService } from './monitoring/monitor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Group,
      GroupMembership,
      Payment,
      Player,
      GroupWallet,
      CryptoTransfer,
      CryptoOutgoingTransfer,
      WalletDerivationCounter,
    ]),
    PaymentsModule,
    UsersModule,
  ],
  controllers: [CryptoController, WebhookController],
  providers: [CryptoService, MonitorService],
  exports: [CryptoService],
})
export class CryptoModule {}
