import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../../common/types/request-context';
import { AiLeadRequestDto, DraftFollowupRequestDto } from './ai.dto';
import { AiService } from './ai.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('lead/summary')
  leadSummary(@Req() req: TenantRequest, @Body() payload: AiLeadRequestDto) {
    return this.aiService.leadSummary(req.tenant!.dealershipId, payload.leadId);
  }

  @Post('lead/score')
  leadScore(@Req() req: TenantRequest, @Body() payload: AiLeadRequestDto) {
    return this.aiService.leadScore(req.tenant!.dealershipId, payload.leadId);
  }

  @Post('lead/draft-followup')
  draftFollowup(@Req() req: TenantRequest, @Body() payload: DraftFollowupRequestDto) {
    return this.aiService.draftFollowup(
      req.tenant!.dealershipId,
      payload.leadId,
      payload.channel,
      payload.tone,
      payload.instruction
    );
  }

  @Post('next-best-action')
  nextBestAction(@Req() req: TenantRequest, @Body() payload: AiLeadRequestDto) {
    return this.aiService.nextBestAction(req.tenant!.dealershipId, payload.leadId);
  }
}
