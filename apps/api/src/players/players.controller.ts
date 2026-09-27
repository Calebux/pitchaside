import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  create(@Body() dto: CreatePlayerDto, @CurrentUser() user: User) {
    return this.playersService.create(dto, user.organizationId);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.playersService.findAll(user.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.playersService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePlayerDto>,
    @CurrentUser() user: User,
  ) {
    return this.playersService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.playersService.remove(id, user.organizationId);
  }
}
