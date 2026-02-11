import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../../common/types/request-context';
import { LeadsService } from './leads.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Req() req: TenantRequest) {
    return this.leadsService.listByDealership(req.tenant!.dealershipId);
  }
}
