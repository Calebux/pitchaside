import { IsString, IsNumber, IsEnum, IsOptional, Min, IsNotEmpty, MinLength, IsBoolean } from 'class-validator';
import { PaymentType } from '../entities/group.entity';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsNumber()
  @Min(1)
  targetPlayers: number;

  @IsNumber()
  @Min(0)
  feePerPlayer: number;

  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsOptional()
  @IsBoolean()
  requireRsvp?: boolean;
}
