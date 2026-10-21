import { IsString, IsNumber, IsOptional, Min, Matches, IsIn } from 'class-validator';

const SUPPORTED_TOKENS = ['USDT', 'USDC'];

export class CreateCryptoPayoutDto {
  @IsString()
  chain: string;

  @IsIn(SUPPORTED_TOKENS)
  token: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Invalid wallet address' })
  toAddress: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  refundPlayerId?: string;

  /** Transfer PIN required for withdrawals. */
  @IsString()
  pin: string;
}
