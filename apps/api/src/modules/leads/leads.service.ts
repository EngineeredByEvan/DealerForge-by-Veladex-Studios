import { Injectable } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tenancy enforcement pattern (v1):
   * - Every service method accepts `dealershipId` from request tenant context.
   * - Every query MUST include `dealershipId` in where/data clauses.
   */
  listByDealership(dealershipId: string): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      where: { dealershipId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
