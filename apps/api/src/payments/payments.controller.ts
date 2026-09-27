import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.paymentsService.create(dto, user.organizationId);
  }

  @Patch(':id/mark-paid')
  markAsPaid(
    @Param('id') id: string,
    @Body('markedBy') markedBy: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.markAsPaid(id, user.organizationId, markedBy);
  }

  @Get('session/:sessionId')
  findBySession(@Param('sessionId') sessionId: string, @CurrentUser() user: User) {
    return this.paymentsService.findBySession(sessionId, user.organizationId);
  }

  @Get('player/:playerId')
  findByPlayer(@Param('playerId') playerId: string, @CurrentUser() user: User) {
    return this.paymentsService.findByPlayer(playerId, user.organizationId);
  }
}
