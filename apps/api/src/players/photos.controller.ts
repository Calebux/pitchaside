import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PhotosService } from './photos.service';

/**
 * Serves player photos. The address is a random key that changes with every upload, so it's
 * hard to guess and can be cached by phones forever.
 */
@Controller('photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get(':key')
  async get(@Param('key') key: string, @Res() res: Response) {
    const photo = await this.photos.get(key);
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(photo.data);
  }
}
