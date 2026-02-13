import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toPrismaJson } from '../../common/prisma/prisma-json';
import { AuditService } from '../audit/audit.service';
import { redactJson } from './ai.safety';
import { AiChannel, AiFeature, AiLeadContext, AiTone } from './ai.types';
import { AI_PROVIDER_TOKEN, AiProvider } from './providers/ai-provider.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private queue: { add: (name: string, data: Record<string, unknown>) => Promise<unknown> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(AI_PROVIDER_TOKEN) private readonly aiProvider: AiProvider
  ) {}

  async leadSummary(dealershipId: string, leadId: string) {
    const context = await this.loadLeadContext(dealershipId, leadId);
    const summary = await this.aiProvider.generateSummary(context);

    await this.enqueueAiJob('lead_summary', dealershipId, leadId, { leadId });
    await this.logRedacted('lead_summary', dealershipId, leadId, { leadId }, { summary });
    await this.auditAiAction(dealershipId, leadId, 'lead_summary');

    return { leadId, summary };
  }

  async leadScore(dealershipId: string, leadId: string) {
    const context = await this.loadLeadContext(dealershipId, leadId);
    const result = await this.aiProvider.generateScore(context);

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
    const draft = await this.aiProvider.generateDraft(context, channel, tone, instruction);

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
    const action = await this.aiProvider.generateNextBestAction(context);

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
        requestPayload: toPrismaJson(redactJson(requestPayload)),
        resultPayload: toPrismaJson(redactJson(resultPayload))
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
