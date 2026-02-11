import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../../common/types/request-context';
import {
  AssignLeadDto,
  CreateLeadDto,
  ListLeadsQueryDto,
  UpdateLeadDto,
  UpdateLeadStatusDto
} from './leads.dto';
import { LeadsService } from './leads.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Req() req: TenantRequest, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.listByDealership(req.tenant!.dealershipId, query);
  }

  @Post()
  create(@Req() req: TenantRequest, @Body() payload: CreateLeadDto) {
    return this.leadsService.createLead(req.tenant!.dealershipId, payload);
  }

  @Get(':id')
  findOne(@Req() req: TenantRequest, @Param('id') leadId: string) {
    return this.leadsService.findById(req.tenant!.dealershipId, leadId);
  }

  @Patch(':id')
  update(@Req() req: TenantRequest, @Param('id') leadId: string, @Body() payload: UpdateLeadDto) {
    return this.leadsService.updateLead(req.tenant!.dealershipId, leadId, payload);
  }

  @Post(':id/assign')
  assign(@Req() req: TenantRequest, @Param('id') leadId: string, @Body() payload: AssignLeadDto) {
    return this.leadsService.assignLead(req.tenant!.dealershipId, leadId, payload);
  }

  @Post(':id/status')
  status(@Req() req: TenantRequest, @Param('id') leadId: string, @Body() payload: UpdateLeadStatusDto) {
    return this.leadsService.updateStatus(req.tenant!.dealershipId, leadId, payload.status);
  }
}
