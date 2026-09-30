import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

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

  @IsString()
  @Length(4, 6)
  pin: string;
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
