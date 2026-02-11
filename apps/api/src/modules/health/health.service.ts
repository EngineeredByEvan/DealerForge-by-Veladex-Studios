import { Injectable } from '@nestjs/common';
import { HealthResponse } from '@dealerforge/shared';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString()
    };
  }
}
