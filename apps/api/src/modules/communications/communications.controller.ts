import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import {
  CreateOrGetThreadDto,
  CreateTemplateDto,
  ListMessagesQueryDto,
  LogCallDto,
  SendLeadSmsDto,
  SendMessageDto,
  UpdateTemplateDto
} from './communications.dto';
import { CommunicationsService } from './communications.service';

type TenantRequest = Request & { tenant?: TenantContext; user?: AuthUser };

@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post('threads')
  createOrGetThread(@Req() req: TenantRequest, @Body() payload: CreateOrGetThreadDto) {
    return this.communicationsService.createOrGetThread(req.tenant!.dealershipId, payload.leadId);
  }

  @Get('threads/lead/:leadId')
  getThreadByLead(@Req() req: TenantRequest, @Param('leadId') leadId: string) {
    return this.communicationsService.getThreadByLead(req.tenant!.dealershipId, leadId);
  }

  @Get('messages')
  listMessages(@Req() req: TenantRequest, @Query() query: ListMessagesQueryDto) {
    return this.communicationsService.listMessages(req.tenant!.dealershipId, query.leadId, query.threadId);
  }

  @Post('leads/:leadId/messages/sms')
  sendSms(
    @Req() req: TenantRequest,
    @Param('leadId') leadId: string,
    @Body() payload: SendLeadSmsDto
  ) {
    return this.communicationsService.sendLeadSms(
      req.tenant!.dealershipId,
      leadId,
      req.user!.userId,
      payload
    );
  }

  @Post('leads/:leadId/send')
  sendMessage(
    @Req() req: TenantRequest,
    @Param('leadId') leadId: string,
    @Body() payload: SendMessageDto
  ) {
    return this.communicationsService.sendMessage(
      req.tenant!.dealershipId,
      leadId,
      req.user!.userId,
      payload
    );
  }

  @Post('leads/:leadId/calls')
  logCall(@Req() req: TenantRequest, @Param('leadId') leadId: string, @Body() payload: LogCallDto) {
    return this.communicationsService.logCall(req.tenant!.dealershipId, leadId, req.user!.userId, payload);
  }

  @Get('templates')
  listTemplates(@Req() req: TenantRequest) {
    return this.communicationsService.listTemplates(req.tenant!.dealershipId);
  }

  @Post('templates')
  createTemplate(@Req() req: TenantRequest, @Body() payload: CreateTemplateDto) {
    return this.communicationsService.createTemplate(req.tenant!.dealershipId, req.user!.userId, payload);
  }

  @Patch('templates/:templateId')
  updateTemplate(
    @Req() req: TenantRequest,
    @Param('templateId') templateId: string,
    @Body() payload: UpdateTemplateDto
  ) {
    return this.communicationsService.updateTemplate(req.tenant!.dealershipId, templateId, payload);
  }

  @Delete('templates/:templateId')
  deleteTemplate(@Req() req: TenantRequest, @Param('templateId') templateId: string) {
    return this.communicationsService.deleteTemplate(req.tenant!.dealershipId, templateId);
  }
}
