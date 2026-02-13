import { Controller, Get, Req } from '@nestjs/common';
import { LeadStatus, LeadType } from '@prisma/client';
import { Request } from 'express';
import { TenantContext } from '../../common/types/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('meta')
export class MetaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('leads')
  async leadsMeta(@Req() req: TenantRequest) {
    const sources = await this.prisma.leadSource.findMany({
      where: { dealershipId: req.tenant!.dealershipId },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }]
    });

    return {
      statuses: Object.values(LeadStatus),
      leadTypes: Object.values(LeadType),
      sources
    };
  }
}
