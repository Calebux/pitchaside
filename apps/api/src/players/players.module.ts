import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player } from './entities/player.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { PlayerPhoto } from './entities/player-photo.entity';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Payment, PlayerPhoto])],
  controllers: [PlayersController, PhotosController],
  providers: [PlayersService, PhotosService],
  exports: [PlayersService, PhotosService],
})
export class PlayersModule {}
