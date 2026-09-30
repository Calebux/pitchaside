import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const CLUB_SORTS = ['newest', 'collected', 'outstanding', 'players'] as const;
export type ClubSort = (typeof CLUB_SORTS)[number];

export class ClubsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(CLUB_SORTS)
  sort?: ClubSort;
}

/** Lists that can be narrowed to one status (transfers, notifications). */
export class StatusQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;
}
