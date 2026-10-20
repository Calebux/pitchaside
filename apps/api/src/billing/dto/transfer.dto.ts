import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { MONEY_IN_CATEGORIES, type MoneyInCategory } from '../entities/bank-transfer.entity';
import { PAYOUT_CATEGORIES, type PayoutCategory } from '../entities/outgoing-transfer.entity';

export class AssignTransferDto {
  @IsUUID()
  paymentId: string;
}

export class GiveTransferDto {
  @IsUUID()
  playerId: string;
}

/** Whose money pays: the sender's extra, or what's waiting for a player. */
export const EXTRA_SOURCES = ['extra', 'waiting'] as const;
export type ExtraSource = (typeof EXTRA_SOURCES)[number];

export class GiveExtraDto extends GiveTransferDto {
  @IsOptional()
  @IsIn(EXTRA_SOURCES)
  from?: ExtraSource;
}

export class HoldExtraDto {
  /** Anything known about who it's for, e.g. "Kunle's friend". */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  note?: string;
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

  /** Test mode only: the account the simulated transfer comes from. */
  @IsOptional()
  @IsString()
  senderAccount?: string;
}

export class NameEnquiryDto {
  @IsString()
  bankCode: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  accountNumber: string;
}

export class InitiatePayoutDto {
  @IsNumber()
  @Min(100)
  @Max(5_000_000)
  amount: number;

  /** Refund this member's credit: the amount comes off what they've paid toward dues. */
  @IsOptional()
  @IsUUID()
  refundPlayerId?: string;

  /** Pay the group's saved payee (pitch owner) instead of the account below. */
  @IsOptional()
  @IsBoolean()
  toPayee?: boolean;

  @ValidateIf((o: InitiatePayoutDto) => !o.toPayee)
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  beneficiaryAccount?: string;

  @ValidateIf((o: InitiatePayoutDto) => !o.toPayee)
  @IsString()
  beneficiaryBankCode?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  /** What it's for; a refund to a player is always 'refund'. */
  @IsOptional()
  @IsIn(PAYOUT_CATEGORIES)
  category?: PayoutCategory;

  @IsString()
  @Length(4, 6)
  pin: string;
}

export class PayoutCategoryDto {
  @IsIn(PAYOUT_CATEGORIES)
  category: PayoutCategory;
}

export class ClassifyTransferDto {
  @IsIn(MONEY_IN_CATEGORIES)
  category: MoneyInCategory;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class SetTransferPinDto {
  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must be digits only' })
  pin: string;

  @IsOptional()
  @IsString()
  currentPin?: string;
}

export class ChangeTransferPinDto {
  @IsString()
  currentPin: string;

  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must be digits only' })
  newPin: string;
}

/** Who the group pays out to, usually the pitch owner or facility manager. */
export class SavePayeeDto {
  @IsString()
  bankCode: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  accountNumber: string;

  /** e.g. "Pitch owner", "Facility manager". */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  /** The usual amount, prefilled when paying them. */
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(5_000_000)
  amount?: number;
}
