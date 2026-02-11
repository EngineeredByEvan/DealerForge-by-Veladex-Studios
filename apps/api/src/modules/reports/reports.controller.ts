import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../../common/types/request-context';
import { ReportsService } from './reports.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  getOverview(@Req() req: TenantRequest) {
    return this.reportsService.getOverview(req.tenant!.dealershipId);
  }

  @Get('response-time')
  getResponseTime(@Req() req: TenantRequest) {
    return this.reportsService.getResponseTime(req.tenant!.dealershipId);
  }
}
