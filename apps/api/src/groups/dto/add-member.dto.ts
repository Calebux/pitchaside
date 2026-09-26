import { IsString, IsEnum, IsOptional } from 'class-validator';
import { MemberRole } from '../entities/group-membership.entity';

export class AddMemberDto {
  @IsString()
  playerId: string;

  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;
}
