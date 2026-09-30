import { IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

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

  @IsString()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  beneficiaryAccount: string;

  @IsString()
  beneficiaryBankCode: string;

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
