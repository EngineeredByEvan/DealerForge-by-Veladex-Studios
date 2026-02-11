import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { redactJson, redactName, redactText } from './ai.safety';
import { AiChannel, AiFeature, AiLeadContext, AiTone, LeadScoreResult } from './ai.types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private queue: { add: (name: string, data: Record<string, unknown>) => Promise<unknown> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async leadSummary(dealershipId: string, leadId: string) {
    const context = await this.loadLeadContext(dealershipId, leadId);
    const summary = this.generateSummary(context);

    await this.enqueueAiJob('lead_summary', dealershipId, leadId, { leadId });
    await this.logRedacted('lead_summary', dealershipId, leadId, { leadId }, { summary });
    await this.auditAiAction(dealershipId, leadId, 'lead_summary');

    return { leadId, summary };
  }

  async leadScore(dealershipId: string, leadId: string) {
    const context = await this.loadLeadContext(dealershipId, leadId);
    const result = this.generateScore(context);

    await this.enqueueAiJob('lead_score', dealershipId, leadId, { leadId });
    await this.logRedacted('lead_score', dealershipId, leadId, { leadId }, result);
    await this.auditAiAction(dealershipId, leadId, 'lead_score');

    return { leadId, ...result };
  }

  async draftFollowup(
    dealershipId: string,
    leadId: string,
    channel: AiChannel = 'EMAIL',
    tone: AiTone = 'FRIENDLY',
    instruction?: string
  ) {
    const context = await this.loadLeadContext(dealershipId, leadId);
    const draft = this.generateDraft(context, channel, tone, instruction);

    await this.logRedacted(
      'draft_followup',
      dealershipId,
      leadId,
      { leadId, channel, tone, instruction },
      draft
    );
    await this.auditAiAction(dealershipId, leadId, 'draft_followup');

    return { leadId, ...draft };
  }

  async nextBestAction(dealershipId: string, leadId: string) {
    const context = await this.loadLeadContext(dealershipId, leadId);
    const action = this.generateNextBestAction(context);

    await this.enqueueAiJob('next_best_action', dealershipId, leadId, { leadId });
    await this.logRedacted('next_best_action', dealershipId, leadId, { leadId }, action);
    await this.auditAiAction(dealershipId, leadId, 'next_best_action');

    return { leadId, ...action };
  }

  private async loadLeadContext(dealershipId: string, leadId: string): Promise<AiLeadContext> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, dealershipId },
      include: {
        source: { select: { name: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { type: true, subject: true, createdAt: true, body: true, outcome: true }
        },
        _count: { select: { activities: true } }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return {
      id: lead.id,
      dealershipId: lead.dealershipId,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      vehicleInterest: lead.vehicleInterest,
      lastActivityAt: lead.lastActivityAt,
      source: lead.source,
      activityCount: lead._count.activities,
      latestActivities: lead.activities
    };
  }

  private generateSummary(context: AiLeadContext): string {
    const name = redactName(context.firstName, context.lastName);
    const interest = context.vehicleInterest ? redactText(context.vehicleInterest) : 'unspecified vehicle';
    const recentActivity = context.latestActivities[0]
      ? `${context.latestActivities[0].type}: ${redactText(context.latestActivities[0].subject)}`
      : 'no recent activities';

    return `${name} is currently ${context.status}. Interested in ${interest}. Latest timeline item: ${recentActivity}. Suggested next step: ${this.generateNextBestAction(context).action}.`;
  }

  private generateScore(context: AiLeadContext): LeadScoreResult {
    let score = 30;
    const reasons: string[] = [];

    if (context.vehicleInterest) {
      score += 20;
      reasons.push('Vehicle interest captured');
    }

    if (context.email || context.phone) {
      score += 15;
      reasons.push('Contact method available');
    }

    if (context.activityCount >= 3) {
      score += 20;
      reasons.push('Active conversation history');
    }

    if (['QUALIFIED', 'APPOINTMENT_SET', 'NEGOTIATING'].includes(context.status)) {
      score += 25;
      reasons.push(`Lead status indicates buying intent (${context.status})`);
    }

    if (context.status === 'LOST') {
      score = 10;
      reasons.push('Lead marked as lost');
    }

    return { score: Math.min(100, score), reasons };
  }

  private generateDraft(
    context: AiLeadContext,
    channel: AiChannel,
    tone: AiTone,
    instruction?: string
  ): { channel: AiChannel; tone: AiTone; message: string } {
    const greeting = channel === 'SMS' ? 'Hi' : 'Hello';
    const firstName = context.firstName?.trim() || 'there';
    const vehicle = context.vehicleInterest ? redactText(context.vehicleInterest) : 'a vehicle you asked about';

    const tonePhrase =
      tone === 'DIRECT'
        ? 'Can we lock in a time to connect today?'
        : tone === 'PROFESSIONAL'
          ? 'Please let me know a convenient time to continue your purchase planning.'
          : 'Would you be open to a quick chat today?';

    const customInstruction = instruction ? ` ${redactText(instruction)}` : '';

    return {
      channel,
      tone,
      message: `${greeting} ${firstName}, thanks again for your interest in ${vehicle}. I can share availability and payment options for you.${customInstruction} ${tonePhrase}`
    };
  }

  private generateNextBestAction(context: AiLeadContext): { action: string; rationale: string } {
    if (!context.phone && context.email) {
      return {
        action: 'Send email with availability and pricing options',
        rationale: 'Lead has email but no phone, so email is the best reachable channel.'
      };
    }

    if (context.status === 'APPOINTMENT_SET') {
      return {
        action: 'Confirm appointment and send reminder',
        rationale: 'Lead is appointment-set and should be protected from no-show risk.'
      };
    }

    if (context.activityCount === 0) {
      return {
        action: 'Call now to establish first contact',
        rationale: 'No activity exists yet, so immediate first-touch outreach is highest leverage.'
      };
    }

    return {
      action: 'Offer payment options and book a dealership visit',
      rationale: 'Lead has engagement history and should be moved toward an in-person commitment.'
    };
  }

  private async enqueueAiJob(
    feature: AiFeature,
    dealershipId: string,
    leadId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      if (!this.queue) {
        const bullmq = require('bullmq') as {
          Queue: new (name: string, options: { connection: { url: string } }) => {
            add: (name: string, data: Record<string, unknown>) => Promise<unknown>;
          };
        };

        this.queue = new bullmq.Queue('ai_queue', {
          connection: {
            url: process.env.REDIS_URL ?? 'redis://localhost:6379'
          }
        });
      }

      await this.queue.add(feature, {
        dealershipId,
        leadId,
        payload: redactJson(payload),
        queuedAt: new Date().toISOString()
      });
    } catch (error) {
      this.logger.warn(`Unable to enqueue ai_queue job for ${feature}: ${(error as Error).message}`);
    }
  }

  private async logRedacted(
    feature: AiFeature,
    dealershipId: string,
    leadId: string,
    requestPayload: Record<string, unknown>,
    resultPayload: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.aIRequestLog.create({
      data: {
        dealershipId,
        leadId,
        feature,
        requestPayload: redactJson(requestPayload),
        resultPayload: redactJson(resultPayload)
      }
    });
  }

  private async auditAiAction(dealershipId: string, leadId: string, feature: AiFeature): Promise<void> {
    await this.auditService.logEvent({
      dealershipId,
      action: 'ai_action_invoked',
      entityType: 'Lead',
      entityId: leadId,
      metadata: { feature }
    });
  }
}
