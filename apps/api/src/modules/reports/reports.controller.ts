import { Controller, Get, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/types/request-context';
import { QueryBreakdownDto, QueryEventLogsDto, QuerySummaryDto, QueryTrendsDto } from './reports.dto';
import { ReportsService } from './reports.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Req() req: TenantRequest, @Query() query: QuerySummaryDto) {
    return this.reportsService.getSummary(req.tenant!.dealershipId, query);
  }

  @Get('breakdown')
  getBreakdown(@Req() req: TenantRequest, @Query() query: QueryBreakdownDto) {
    return this.reportsService.getBreakdown(req.tenant!.dealershipId, query);
  }

  @Get('trends')
  getTrends(@Req() req: TenantRequest, @Query() query: QueryTrendsDto) {
    return this.reportsService.getTrends(req.tenant!.dealershipId, query);
  }

  @Get('events')
  @Roles(Role.ADMIN)
  getEventLogs(@Req() req: TenantRequest, @Query() query: QueryEventLogsDto) {
    return this.reportsService.listEventLogs(req.tenant!.dealershipId, query);
  }
}
