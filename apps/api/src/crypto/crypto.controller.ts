import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AllowTreasurer } from '../auth/decorators/allow-treasurer.decorator';
import { User } from '../users/entities/user.entity';
import { CryptoService } from './crypto.service';
import { CreateCryptoPayoutDto } from './dto/create-crypto-payout.dto';

const PIN_RATE_LIMIT = { default: { ttl: 60_000, limit: 10 } };

@UseGuards(JwtAuthGuard)
@Controller('crypto')
export class CryptoController {
  constructor(private readonly crypto: CryptoService) {}

  /** List supported chains and tokens. */
  @Get('chains')
  getSupportedChains() {
    return this.crypto.getSupportedChains();
  }

  /** Get a group's wallet addresses per chain family. */
  @Get('groups/:id/wallets')
  getWallets(@Param('id') id: string, @CurrentUser() user: User) {
    return this.crypto.getGroupWallets(id, user.organizationId);
  }

  /** List incoming crypto transfers for a group. */
  @AllowTreasurer()
  @Get('groups/:id/transfers')
  getTransfers(@Param('id') id: string, @CurrentUser() user: User) {
    return this.crypto.listTransfers(id, user.organizationId);
  }

  /** Get the group's crypto balance summary. */
  @Get('groups/:id/balance')
  getBalance(@Param('id') id: string, @CurrentUser() user: User) {
    return this.crypto.getGroupBalance(id, user.organizationId);
  }

  /** Assign an unmatched transfer to a specific payment. */
  @AllowTreasurer()
  @Post('transfers/:id/assign')
  assignTransfer(
    @Param('id') id: string,
    @Body() body: { paymentId: string },
    @CurrentUser() user: User,
  ) {
    return this.crypto.assignTransfer(id, body.paymentId, user.organizationId);
  }

  /** Give an unmatched transfer to a player. */
  @AllowTreasurer()
  @Post('transfers/:id/give')
  giveTransfer(
    @Param('id') id: string,
    @Body() body: { playerId: string },
    @CurrentUser() user: User,
  ) {
    return this.crypto.giveTransfer(id, body.playerId, user.organizationId);
  }

  /** Dismiss a transfer (not a player's payment). */
  @AllowTreasurer()
  @Post('transfers/:id/ignore')
  ignoreTransfer(@Param('id') id: string, @CurrentUser() user: User) {
    return this.crypto.ignoreTransfer(id, user.organizationId);
  }

  /** Restore an ignored transfer back to unmatched. */
  @AllowTreasurer()
  @Post('transfers/:id/restore')
  restoreTransfer(@Param('id') id: string, @CurrentUser() user: User) {
    return this.crypto.restoreTransfer(id, user.organizationId);
  }

  /** Initiate a crypto withdrawal (PIN-protected). */
  @Post('groups/:id/withdraw')
  @Throttle(PIN_RATE_LIMIT)
  @UseGuards(ThrottlerGuard)
  initiateWithdrawal(
    @Param('id') id: string,
    @Body() dto: CreateCryptoPayoutDto,
    @CurrentUser() user: User,
  ) {
    return this.crypto.initiateWithdrawal(id, user.organizationId, user.id, dto);
  }

  /** List outgoing crypto transfers (payouts) for a group. */
  @AllowTreasurer()
  @Get('groups/:id/payouts')
  getPayouts(@Param('id') id: string, @CurrentUser() user: User) {
    return this.crypto.listPayouts(id, user.organizationId);
  }
}
