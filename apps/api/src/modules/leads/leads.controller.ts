import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import {
  AssignLeadDto,
  CreateLeadDto,
  ListLeadsQueryDto,
  UpdateLeadDto,
  UpdateLeadStatusDto
} from './leads.dto';
import { LeadsService } from './leads.service';
import { LeadScoringService } from './lead-scoring.service';

type TenantRequest = Request & { tenant?: TenantContext; user?: AuthUser };

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadScoringService: LeadScoringService
  ) {}

  @Get()
  findAll(@Req() req: TenantRequest, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.listByDealership(req.tenant!.dealershipId, query);
  }

  @Post()
  create(@Req() req: TenantRequest, @Body() payload: CreateLeadDto) {
    return this.leadsService.createLead(req.tenant!.dealershipId, payload, req.user?.userId, req.tenant?.role);
  }

  @Get('options')
  options(@Req() req: TenantRequest) {
    return this.leadsService.getOptions(req.tenant!.dealershipId);
  }

  @Get(':id')
  findOne(@Req() req: TenantRequest, @Param('id') leadId: string) {
    return this.leadsService.findById(req.tenant!.dealershipId, leadId);
  }


  @Get(':id/messages')
  messages(
    @Req() req: TenantRequest,
    @Param('id') leadId: string,
    @Query('channel') channel?: 'SMS' | 'EMAIL' | 'CALL' | 'NOTE'
  ) {
    return this.leadsService.listLeadMessages(req.tenant!.dealershipId, leadId, channel);
  }

  @Get(':id/timeline')
  timeline(
    @Req() req: TenantRequest,
    @Param('id') leadId: string,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string
  ) {
    return this.leadsService.listTimeline(req.tenant!.dealershipId, leadId, limit, cursor);
  }

  @Get(':id/ai/lead-score')
  leadScore(@Req() req: TenantRequest, @Param('id') leadId: string) {
    return this.leadScoringService.calculateLeadScore(leadId, req.tenant!.dealershipId);
  }

  @Patch(':id')
  update(@Req() req: TenantRequest, @Param('id') leadId: string, @Body() payload: UpdateLeadDto) {
    return this.leadsService.updateLead(req.tenant!.dealershipId, leadId, payload, req.user?.userId);
  }

  @Patch(':id/assign')
  assign(@Req() req: TenantRequest, @Param('id') leadId: string, @Body() payload: AssignLeadDto) {
    return this.leadsService.assignLead(req.tenant!.dealershipId, leadId, payload, req.user?.userId, req.tenant?.role);
  }

  @Patch(':id/status')
  status(@Req() req: TenantRequest, @Param('id') leadId: string, @Body() payload: UpdateLeadStatusDto) {
    return this.leadsService.updateStatus(req.tenant!.dealershipId, leadId, payload.status, req.user?.userId, req.tenant?.role);
  }
}
