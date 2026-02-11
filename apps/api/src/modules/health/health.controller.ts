import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { HealthService } from './health.service';

@Controller('health')
@Public()
@SkipTenant()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.getHealth();
  }
}
