import { IsDateString, IsOptional, Matches } from 'class-validator';

/** Move a game that hasn't started: a new day, a new kick-off time, or both. */
export class UpdateSessionDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  /** "HH:mm"; an empty string goes back to the group's usual kick-off time. */
  @IsOptional()
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Kick-off time must be HH:mm' })
  kickoffTime?: string;
}
