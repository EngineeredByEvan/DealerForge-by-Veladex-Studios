import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Deprecated in Phase 1.
 * Tenancy is enforced by TenantGuard so auth endpoints can resolve identity
 * before an active dealership is selected.
 */
@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    next();
  }
}
