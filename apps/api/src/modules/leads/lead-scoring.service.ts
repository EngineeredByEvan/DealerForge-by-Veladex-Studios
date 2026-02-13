import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MAX_LEAD_SCORE, MIN_LEAD_SCORE } from './lead-scoring.rules';

type NumericScoreBreakdown = {
  contactability: number;
  engagement: number;
  appointment: number;
  stage: number;
  freshness: number;
  penalty: number;
  total: number;
};

type LeadScoreResponse = {
  leadId: string;
  score: number;
  breakdown: NumericScoreBreakdown;
  reasons: string[];
  updatedAt: string;
};

const LEAD_STAGE_SCORES: Record<string, number> = {
  NEW: 0,
  CONTACTED: 5,
  QUALIFIED: 10,
  APPOINTMENT_SET: 15,
  NEGOTIATING: 18,
  SOLD: 20,
  LOST: 0
};

@Injectable()
export class LeadScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async computeScore(leadId: string, dealershipId: string) {
    const now = new Date();

    const lead = await (this.prisma as any).lead.findFirst({
      where: { id: leadId, dealershipId },
      select: {
        id: true,
        status: true,
        soldAt: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        vehicleInterest: true,
        lastActivityAt: true
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.status === 'SOLD' || Boolean(lead.soldAt)) {
      return {
        score: 100,
        breakdown: {
          contactability: 0,
          engagement: 0,
          appointment: 0,
          stage: 20,
          freshness: 0,
          penalty: 0,
          total: 100
        } satisfies NumericScoreBreakdown
      };
    }

    const [
      outboundMessageExists,
      inboundMessageExists,
      outboundMessageCount,
      callMessageCount,
      callActivityCount,
      hasShowedAppointment,
      hasFutureSetOrConfirmedAppointment,
      hasNoShowAppointment
    ] = await Promise.all([
      (this.prisma as any).message.count({
        where: {
          dealershipId,
          thread: { leadId },
          direction: 'OUTBOUND',
          channel: { in: ['SMS', 'EMAIL'] }
        },
        take: 1
      }),
      (this.prisma as any).message.count({
        where: {
          dealershipId,
          thread: { leadId },
          direction: 'INBOUND'
        },
        take: 1
      }),
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
      }),
      (this.prisma as any).activity.count({
        where: {
          leadId,
          type: 'CALL',
          lead: { dealershipId }
        }
      }),
      (this.prisma as any).appointment.count({
        where: {
          dealershipId,
          lead_id: leadId,
          status: 'SHOWED'
        },
        take: 1
      }),
      (this.prisma as any).appointment.count({
        where: {
          dealershipId,
          lead_id: leadId,
          status: { in: ['SET', 'CONFIRMED'] },
          start_at: { gt: now }
        },
        take: 1
      }),
      (this.prisma as any).appointment.count({
        where: {
          dealershipId,
          lead_id: leadId,
          status: 'NO_SHOW'
        },
        take: 1
      })
    ]);

    const normalizedPhone = (lead.phone ?? '').replace(/\D/g, '');
    const hasPhone = normalizedPhone.length >= 10;
    const hasEmail = (lead.email ?? '').includes('@');
    const hasFirst = Boolean(lead.firstName?.trim());
    const hasLast = Boolean(lead.lastName?.trim());
    const hasVehicleInterest = Boolean(lead.vehicleInterest?.trim());

    const contactability =
      (hasPhone ? 10 : 0)
      + (hasEmail ? 10 : 0)
      + (hasFirst && hasLast ? 5 : hasFirst || hasLast ? 3 : 0)
      + (hasVehicleInterest ? 5 : 0);

    const totalCallAttempts = callMessageCount + callActivityCount;
    const contactAttempts = outboundMessageCount + totalCallAttempts;
    const engagementRaw =
      (outboundMessageExists > 0 ? 12 : 0)
      + (inboundMessageExists > 0 ? 18 : 0)
      + (totalCallAttempts > 0 ? 10 : 0)
      + (contactAttempts >= 3 ? 5 : 0);
    const engagement = Math.min(35, engagementRaw);

    let appointment = 0;
    if (hasShowedAppointment > 0) {
      appointment = 25;
    } else if (hasFutureSetOrConfirmedAppointment > 0) {
      appointment = 20;
    }

    const stage = LEAD_STAGE_SCORES[lead.status] ?? 0;

    let freshness = 0;
    if (lead.lastActivityAt) {
      const ageMs = now.getTime() - lead.lastActivityAt.getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const threeDaysMs = 3 * oneDayMs;
      const fourteenDaysMs = 14 * oneDayMs;
      if (ageMs <= oneDayMs) freshness = 5;
      else if (ageMs <= threeDaysMs) freshness = 2;
      else if (ageMs > fourteenDaysMs) freshness = -5;
    }

    const penalty = hasNoShowAppointment > 0 ? -10 : 0;

    const total = Math.max(
      MIN_LEAD_SCORE,
      Math.min(MAX_LEAD_SCORE, contactability + engagement + appointment + stage + freshness + penalty)
    );

    return {
      score: total,
      breakdown: {
        contactability,
        engagement,
        appointment,
        stage,
        freshness,
        penalty,
        total
      } satisfies NumericScoreBreakdown
    };
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

  async calculateLeadScore(leadId: string, dealershipId: string): Promise<LeadScoreResponse> {
    const { score, breakdown } = await this.computeScore(leadId, dealershipId);
    const persisted = await (this.prisma as any).lead.update({
      where: { id: leadId },
      data: {
        leadScore: score,
        leadScoreUpdatedAt: new Date()
      },
      select: { id: true, leadScoreUpdatedAt: true }
    });

    return {
      leadId,
      score,
      breakdown,
      reasons: this.buildReasons(breakdown),
      updatedAt: persisted.leadScoreUpdatedAt.toISOString()
    };
  }

  private buildReasons(breakdown: NumericScoreBreakdown): string[] {
    const reasons: string[] = [];

    if (breakdown.contactability > 0) {
      reasons.push(`+${breakdown.contactability} contactability signals present`);
    }
    if (breakdown.engagement > 0) {
      reasons.push(`+${breakdown.engagement} engagement from outreach and replies`);
    }
    if (breakdown.appointment > 0) {
      reasons.push(`+${breakdown.appointment} appointment progress`);
    }
    if (breakdown.stage > 0) {
      reasons.push(`+${breakdown.stage} pipeline stage weighting`);
    }
    if (breakdown.freshness > 0) {
      reasons.push(`+${breakdown.freshness} recent activity freshness`);
    } else if (breakdown.freshness < 0) {
      reasons.push(`${breakdown.freshness} stale lead activity penalty`);
    }
    if (breakdown.penalty < 0) {
      reasons.push(`${breakdown.penalty} no-show penalty`);
    }

    reasons.push(`Total score: ${breakdown.total}/100`);
    return reasons;
  }
}
