import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  Logger,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipCsrf } from '../../auth/decorators/skip-csrf.decorator';
import { CryptoService } from '../crypto.service';

/**
 * Public endpoints that receive chain-monitoring webhooks (Alchemy, TronGrid, Helius).
 * CSRF is skipped because these come from external services, not browsers.
 */
@Controller('crypto/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly crypto: CryptoService) {}

  @SkipCsrf()
  @Post(':chain')
  @HttpCode(200)
  async handleWebhook(
    @Param('chain') chain: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-alchemy-signature') alchemySig: string | undefined,
    @Headers('x-webhook-signature') genericSig: string | undefined,
    @Body() body: unknown,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    const signature = alchemySig || genericSig || '';

    try {
      const result = await this.crypto.handleIncomingTransfer(chain, raw, signature, body);
      return { status: result ? 'recorded' : 'ignored' };
    } catch (err) {
      this.logger.error(`Webhook error for ${chain}: ${err}`);
      throw new BadRequestException('Failed to process webhook');
    }
  }
}
