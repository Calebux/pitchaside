import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Payment])],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
