import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Patch(':id/mark-paid')
  markAsPaid(@Param('id') id: string, @Body('markedBy') markedBy?: string) {
    return this.paymentsService.markAsPaid(id, markedBy);
  }

  @Get('session/:sessionId')
  findBySession(@Param('sessionId') sessionId: string) {
    return this.paymentsService.findBySession(sessionId);
  }

  @Get('player/:playerId')
  findByPlayer(@Param('playerId') playerId: string) {
    return this.paymentsService.findByPlayer(playerId);
  }
}
