import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const dealershipId = req.header('x-dealership-id');

    if (!dealershipId) {
      throw new BadRequestException('x-dealership-id header is required');
    }

    next();
  }
}
