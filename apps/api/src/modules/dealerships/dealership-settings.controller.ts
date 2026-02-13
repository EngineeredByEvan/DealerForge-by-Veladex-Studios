import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PlatformOrDealershipAdminGuard } from '../../common/guards/platform-or-dealership-admin.guard';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { UpdateDealershipSettingsDto } from './dealerships.dto';
import { DealershipsService } from './dealerships.service';

type TenantRequest = Request & { user?: AuthUser; tenant?: TenantContext };

@Controller('dealerships')
@UseGuards(PlatformOrDealershipAdminGuard)
export class DealershipSettingsController {
  constructor(private readonly dealershipsService: DealershipsService) {}

  @Get(':dealershipId')
  getById(@Req() req: TenantRequest, @Param('dealershipId') dealershipId: string) {
    return this.dealershipsService.getSettings(dealershipId, req.user!, req.tenant);
  }

  @Patch(':dealershipId')
  updateById(
    @Req() req: TenantRequest,
    @Param('dealershipId') dealershipId: string,
    @Body() payload: UpdateDealershipSettingsDto
  ) {
    return this.dealershipsService.updateSettings(dealershipId, payload, req.user!, req.tenant);
  }
}
