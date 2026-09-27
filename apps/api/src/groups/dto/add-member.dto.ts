import { IsUUID, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { MemberRole } from '../entities/group-membership.entity';

export class AddMemberDto {
  @IsUUID()
  @IsNotEmpty()
  playerId: string;

  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;
}
