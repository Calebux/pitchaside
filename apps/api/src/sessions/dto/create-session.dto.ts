import { IsUUID, IsDateString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

export enum RecurrenceType {
  NONE = 'none',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

export class CreateSessionDto {
  @IsUUID()
  @IsNotEmpty()
  groupId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(52)
  recurrenceCount?: number;
}
