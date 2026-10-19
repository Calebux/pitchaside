import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class EndGameDto {
  /** Payment ids of players who said they were in and didn't come. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  noShows?: string[];
}
