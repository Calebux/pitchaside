import { IsUUID, IsDateString, IsNotEmpty, IsOptional, IsEnum, IsInt, Matches, Min, Max } from 'class-validator';

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

  /** "HH:mm"; left out, the group's kick-off time applies. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Kick-off time must be HH:mm' })
  kickoffTime?: string;

  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(52)
  recurrenceCount?: number;
}
