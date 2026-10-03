import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ClockAction } from '../match-clock.service';

/** One tap on the match clock. */
export class ClockActionDto {
  @IsIn(['start', 'pause', 'reset', 'adjust', 'teams'])
  action: ClockAction['action'];

  /** reset: the set length to go back to. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  minutes?: number;

  /** adjust: minutes to add (or take off). */
  @IsOptional()
  @IsInt()
  @Min(-30)
  @Max(30)
  delta?: number;

  /** teams: the two sides on. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(['A', 'B', 'C', 'D', 'E', 'F'], { each: true })
  teams?: string[];

  toAction(): ClockAction {
    switch (this.action) {
      case 'reset':
        return { action: 'reset', minutes: this.minutes };
      case 'adjust':
        return { action: 'adjust', delta: this.delta ?? 0 };
      case 'teams':
        return { action: 'teams', teams: this.teams ?? [] };
      default:
        return { action: this.action };
    }
  }
}
