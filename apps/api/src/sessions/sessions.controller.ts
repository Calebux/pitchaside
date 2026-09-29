import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { toCsv } from '../common/csv.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AllowTreasurer } from '../auth/decorators/allow-treasurer.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() dto: CreateSessionDto, @CurrentUser() user: User) {
    return this.sessionsService.create(dto, user.organizationId);
  }

  @Get()
  findAll(
    @Query() query: PaginationDto,
    @Query('groupId') groupId: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.findAllPaginated(user.organizationId, query, groupId);
  }

  @Get(':id/export')
  async exportCsv(@Param('id') id: string, @CurrentUser() user: User, @Res() res: Response) {
    const session = await this.sessionsService.findOne(id, user.organizationId);
    const payments = session.payments || [];
    const csv = toCsv(
      ['Player', 'Amount', 'Status', 'Paid At', 'Marked By'],
      payments.map((p) => [
        p.player ? `${p.player.firstName} ${p.player.lastName}` : 'Unknown',
        String(p.amount),
        p.status,
        p.paidAt ? new Date(p.paidAt).toISOString() : '',
        p.markedBy || '',
      ]),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=session-${id.slice(0, 8)}.csv`);
    res.send(csv);
  }

  @AllowTreasurer()
  @Post(':id/send-reminders')
  sendReminders(@Param('id') id: string, @CurrentUser() user: User) {
    return this.sessionsService.sendReminders(id, user.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.sessionsService.findOne(id, user.organizationId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.updateStatus(id, status, user.organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.sessionsService.remove(id, user.organizationId);
  }
}
