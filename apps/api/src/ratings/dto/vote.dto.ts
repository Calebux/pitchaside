import { IsNotEmpty, IsObject, IsString, Matches } from 'class-validator';

export class IdentifyVoterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+\d][\d\s\-().]{6,}$/, { message: 'Phone number format is invalid' })
  phone: string;
}

export class SubmitVotesDto extends IdentifyVoterDto {
  /** category → nominee player id, e.g. { potm: "<uuid>", pace: "<uuid>" } */
  @IsObject()
  picks: Record<string, string>;
}
