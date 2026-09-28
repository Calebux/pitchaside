import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class AssignTransferDto {
  @IsUUID()
  paymentId: string;
}

export class SimulateTransferDto {
  @IsNumber()
  @Min(1)
  @Max(10_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}
