import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsUUID } from 'class-validator';
import { RsvpService } from './rsvp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

export class OrganiserRsvpDto {
  @IsUUID()
  playerId: string;

  @IsIn(['in', 'out'])
  status: 'in' | 'out';
}

/** Organiser's team sheet for a game. */
@UseGuards(JwtAuthGuard)
@Controller('sessions/:id/rsvp')
export class RsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get()
  board(@Param('id') id: string, @CurrentUser() user: User) {
    return this.rsvp.boardFor(id, user.organizationId);
  }

  @Post()
  set(@Param('id') id: string, @Body() dto: OrganiserRsvpDto, @CurrentUser() user: User) {
    return this.rsvp.setByOrganiser(id, dto.playerId, dto.status, user.organizationId);
  }
}
