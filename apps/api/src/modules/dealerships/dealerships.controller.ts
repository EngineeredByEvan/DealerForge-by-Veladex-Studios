import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { CreateDealershipDto, ListDealershipsDto, UpdateDealershipDto } from './dealerships.dto';
import { DealershipsService } from './dealerships.service';

type RequestWithContext = Request & { user?: AuthUser; tenant?: TenantContext };

@Controller('platform/dealerships')
export class DealershipsController {
  constructor(private readonly dealershipsService: DealershipsService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() payload: CreateDealershipDto, @Req() request: RequestWithContext) {
    return this.dealershipsService.create(payload, request.user, request.tenant);
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
