import { IsUUID, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { PaymentStatus } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  sessionId: string;

  @IsUUID()
  playerId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
