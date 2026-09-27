import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: User) {
    return this.groupsService.create(dto, user.organizationId);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @CurrentUser() user: User) {
    return this.groupsService.findAllPaginated(user.organizationId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.groupsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateGroupDto>,
    @CurrentUser() user: User,
  ) {
    return this.groupsService.update(id, dto, user.organizationId);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @CurrentUser() user: User) {
    return this.groupsService.addMember(id, dto, user.organizationId);
  }

  @Delete(':id/members/:playerId')
  removeMember(
    @Param('id') id: string,
    @Param('playerId') playerId: string,
    @CurrentUser() user: User,
  ) {
    return this.groupsService.removeMember(id, playerId, user.organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.groupsService.remove(id, user.organizationId);
  }
}
