import { IsString, IsNotEmpty } from 'class-validator';

export class TwoFactorVerifyDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class TwoFactorValidateDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
