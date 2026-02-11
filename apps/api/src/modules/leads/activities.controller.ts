import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { CreateActivityDto } from './activities.dto';
import { ActivitiesService } from './activities.service';

type TenantRequest = Request & { tenant?: TenantContext; user?: AuthUser };

@Controller('leads/:id/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  list(@Req() req: TenantRequest, @Param('id') leadId: string) {
    return this.activitiesService.listByLead(req.tenant!.dealershipId, leadId);
  }

  @Post()
  create(
    @Req() req: TenantRequest,
    @Param('id') leadId: string,
    @Body() payload: CreateActivityDto
  ) {
    return this.activitiesService.createForLead(
      req.tenant!.dealershipId,
      leadId,
      req.user!.userId,
      payload
    );
  }
}
