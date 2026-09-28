import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { JoinGroupDto } from './dto/join-group.dto';
import { AssignTransferDto, SimulateTransferDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/** Admin endpoints for a group's account, invite link and incoming transfers. */
@UseGuards(JwtAuthGuard)
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  private link(code: string) {
    return `${this.config.get('APP_URL', 'http://localhost:3000')}/g/${code}`;
  }

  private async billingWithLink(groupId: string, organizationId: string) {
    const billing = await this.billing.getBilling(groupId, organizationId);
    return { ...billing, link: this.link(billing.inviteCode) };
  }

  @Get('groups/:id/billing')
  getBilling(@Param('id') id: string, @CurrentUser() user: User) {
    return this.billingWithLink(id, user.organizationId);
  }

  /** Retry account provisioning (e.g. if Payrep was down when the group was created). */
  @Post('groups/:id/account')
  provisionAccount(@Param('id') id: string, @CurrentUser() user: User) {
    return this.billingWithLink(id, user.organizationId);
  }

  @Post('groups/:id/invite/regenerate')
  async regenerateInvite(@Param('id') id: string, @CurrentUser() user: User) {
    await this.billing.regenerateInviteCode(id, user.organizationId);
    return this.billingWithLink(id, user.organizationId);
  }

  @Get('groups/:id/transfers')
  listTransfers(@Param('id') id: string, @CurrentUser() user: User) {
    return this.billing.listTransfers(id, user.organizationId);
  }

  @Post('groups/:id/transfers/simulate')
  simulate(@Param('id') id: string, @Body() dto: SimulateTransferDto, @CurrentUser() user: User) {
    return this.billing.simulateTransfer(id, user.organizationId, dto);
  }

  @Post('transfers/:id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTransferDto, @CurrentUser() user: User) {
    return this.billing.assignTransfer(id, dto.paymentId, user.organizationId);
  }

  @Post('transfers/:id/ignore')
  ignore(@Param('id') id: string, @CurrentUser() user: User) {
    return this.billing.ignoreTransfer(id, user.organizationId);
  }
}

/** Unauthenticated endpoints: the shareable group link and the Payrep webhook. */
@Controller()
export class PublicBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('public/groups/:code')
  getGroup(@Param('code') code: string) {
    return this.billing.getPublicGroup(code);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('public/groups/:code/join')
  join(@Param('code') code: string, @Body() dto: JoinGroupDto) {
    return this.billing.joinGroup(code, dto);
  }

  @Post('payrep/webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-payrep-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    return this.billing.handleWebhook(raw, signature, body);
  }
}
