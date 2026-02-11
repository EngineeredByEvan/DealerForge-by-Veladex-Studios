import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateActivityDto } from './activities.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

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
