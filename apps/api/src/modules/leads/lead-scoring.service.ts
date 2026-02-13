import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LEAD_SCORE_RULES, MAX_LEAD_SCORE, MIN_LEAD_SCORE } from './lead-scoring.rules';

type ScoreBreakdown = Record<keyof typeof LEAD_SCORE_RULES, boolean>;

const STATUS_RANK: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  QUALIFIED: 2,
  APPOINTMENT_SET: 3,
  NEGOTIATING: 4,
  SOLD: 5,
  LOST: 6
};

@Injectable()
export class LeadScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async computeScore(leadId: string, dealershipId: string) {
    const lead = await (this.prisma as any).lead.findFirst({
      where: { id: leadId, dealershipId },
      select: {
        id: true,
        status: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        vehicleInterest: true,
        sourceId: true,
        soldAt: true,
        appointments: {
          where: {
            start_at: { gt: new Date() },
            status: { in: ['SET', 'CONFIRMED'] }
          },
          select: { id: true },
          take: 1
        }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const [outboundMessageCount, callCount] = await Promise.all([
      (this.prisma as any).message.count({
        where: {
          dealershipId,
          thread: { leadId },
          direction: 'OUTBOUND',
          channel: { in: ['SMS', 'EMAIL'] }
        }
      }),
      (this.prisma as any).message.count({
        where: {
          dealershipId,
          thread: { leadId },
          channel: 'CALL'
        }
      })
    ]);

    const breakdown: ScoreBreakdown = {
      namePresent: Boolean(lead.firstName || lead.lastName),
      phonePresent: Boolean(lead.phone),
      emailPresent: Boolean(lead.email),
      vehicleInterestPresent: Boolean(lead.vehicleInterest),
      sourcePresent: Boolean(lead.sourceId),
      contactedOrBeyond: STATUS_RANK[lead.status] >= STATUS_RANK.CONTACTED,
      appointmentSetOrFutureAppointment: lead.status === 'APPOINTMENT_SET' || lead.appointments.length > 0,
      outboundMessageExists: outboundMessageCount > 0,
      callLogged: callCount > 0,
      sold: lead.status === 'SOLD' || Boolean(lead.soldAt)
    };

    const score = Math.max(
      MIN_LEAD_SCORE,
      Math.min(
        MAX_LEAD_SCORE,
        Object.entries(breakdown).reduce((total, [key, enabled]) => {
          if (!enabled) return total;
          return total + LEAD_SCORE_RULES[key as keyof typeof LEAD_SCORE_RULES];
        }, 0)
      )
    );

    return { score, breakdown };
  }

  async recalculateAndPersist(leadId: string, dealershipId: string) {
    const { score } = await this.computeScore(leadId, dealershipId);

    return (this.prisma as any).lead.update({
      where: { id: leadId },
      data: {
        leadScore: score,
        leadScoreUpdatedAt: new Date()
      },
      select: { id: true, leadScore: true, leadScoreUpdatedAt: true }
    });
  }
}
