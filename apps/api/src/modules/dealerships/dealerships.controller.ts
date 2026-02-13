import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { CreateDealershipDto, ListDealershipsDto, UpdateDealershipDto } from './dealerships.dto';
import { DealershipsService } from './dealerships.service';

@Controller('platform/dealerships')
@SkipTenant()
@PlatformAdmin()
export class DealershipsController {
  constructor(private readonly dealershipsService: DealershipsService) {}

  @Post()
  create(@Body() payload: CreateDealershipDto) {
    return this.dealershipsService.create(payload);
  }

  @Get()
  list(@Query() query: ListDealershipsDto) {
    return this.dealershipsService.list(query);
  }

  @Patch(':dealershipId')
  update(@Param('dealershipId') dealershipId: string, @Body() payload: UpdateDealershipDto) {
    return this.dealershipsService.update(dealershipId, payload);
  }

  @Post(':dealershipId/deactivate')
  deactivate(@Param('dealershipId') dealershipId: string) {
    return this.dealershipsService.deactivate(dealershipId);
  }
}
