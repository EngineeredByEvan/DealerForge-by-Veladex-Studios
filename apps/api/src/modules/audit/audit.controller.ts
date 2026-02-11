import { Controller, Get, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContext } from '../../common/types/request-context';
import { AuditService } from './audit.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  listRecent(@Req() req: TenantRequest, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 50;
    return this.auditService.listRecent(req.tenant!.dealershipId, Number.isNaN(parsedLimit) ? 50 : parsedLimit);
  }
}
