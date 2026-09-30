import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { clientAddress } from '../rate-limit';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      // The address is the one rate limits count against — if every line shows the same one, they're shared.
      this.logger.log(`${method} ${originalUrl} ${statusCode} ${duration}ms ${clientAddress(req)}`);
    });

    next();
  }
}
