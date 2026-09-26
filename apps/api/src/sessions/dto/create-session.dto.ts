import { IsString, IsDateString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  groupId: string;

  @IsDateString()
  date: string;
}
