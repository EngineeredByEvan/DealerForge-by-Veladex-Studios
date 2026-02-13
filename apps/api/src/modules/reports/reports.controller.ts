import { Controller, Get, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/types/request-context';
import { QueryEventLogsDto } from './reports.dto';
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

  @Get('events')
  @Roles(Role.ADMIN)
  getEventLogs(@Req() req: TenantRequest, @Query() query: QueryEventLogsDto) {
    return this.reportsService.listEventLogs(req.tenant!.dealershipId, query);
  }
}

