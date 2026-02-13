import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateActivityDto } from './activities.dto';
import { LeadScoringService } from './lead-scoring.service';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly leadScoringService: LeadScoringService
  ) {}

  async listByLead(dealershipId: string, leadId: string) {
    await this.ensureLeadExists(dealershipId, leadId);

    return this.prisma.activity.findMany({
      where: { leadId },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }]
    });
  }

  async createForLead(
    dealershipId: string,
    leadId: string,
    createdByUserId: string,
    payload: CreateActivityDto
  ) {
    await this.ensureLeadExists(dealershipId, leadId);

    const now = new Date();

    const [activity] = await this.prisma.$transaction([
      this.prisma.activity.create({
        data: {
          leadId,
          createdByUserId,
          type: payload.type,
          subject: payload.subject.trim(),
          body: payload.body,
          outcome: payload.outcome
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }),
      this.prisma.lead.update({
        where: { id: leadId },
        data: { lastActivityAt: now },
        select: { id: true }
      })
    ]);

    await this.leadScoringService.recalculateAndPersist(leadId, dealershipId);

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: createdByUserId },
      action: 'activity_logged',
      entityType: 'Activity',
      entityId: activity.id,
      metadata: { leadId, type: activity.type, subject: activity.subject }
    });

    return activity;
  }

  private async ensureLeadExists(dealershipId: string, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, dealershipId },
      select: { id: true }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }
}
