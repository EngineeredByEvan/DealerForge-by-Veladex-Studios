import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventLogService } from '../event-log/event-log.service';
import {
  EMAIL_PROVIDER_TOKEN,
  EmailProvider
} from './providers/email-provider.interface';
import { SMS_PROVIDER_TOKEN, SmsProvider } from './providers/sms-provider.interface';
import {
  TELEPHONY_PROVIDER_TOKEN,
  TelephonyProvider
} from './providers/telephony-provider.interface';
import { CommunicationChannel, CommunicationDirection, CreateTemplateDto, LogCallDto, SendMessageDto, UpdateTemplateDto } from './communications.dto';

const MESSAGE_INCLUDE = {
  actorUser: {
    select: { id: true, firstName: true, lastName: true, email: true }
  },
  thread: {
    select: { id: true, leadId: true }
  }
} satisfies Prisma.MessageInclude;

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventLogService: EventLogService,
    @Inject(SMS_PROVIDER_TOKEN) private readonly smsProvider: SmsProvider,
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly emailProvider: EmailProvider,
    @Inject(TELEPHONY_PROVIDER_TOKEN) private readonly telephonyProvider: TelephonyProvider
  ) {}

  async createOrGetThread(dealershipId: string, leadId: string) {
    await this.ensureLeadExists(dealershipId, leadId);

    return (this.prisma as any).conversationThread.upsert({
      where: { dealershipId_leadId: { dealershipId, leadId } },
      update: {},
      create: { dealershipId, leadId }
    });
  }

  async getThreadByLead(dealershipId: string, leadId: string) {
    await this.ensureLeadExists(dealershipId, leadId);

    return (this.prisma as any).conversationThread.findUnique({
      where: { dealershipId_leadId: { dealershipId, leadId } }
    });
  }

  async listMessages(dealershipId: string, leadId?: string, threadId?: string) {
    if (!leadId && !threadId) {
      throw new BadRequestException('Either leadId or threadId is required');
    }

    if (threadId) {
      await this.ensureThread(dealershipId, threadId);
      return (this.prisma as any).message.findMany({ where: { dealershipId, threadId }, include: MESSAGE_INCLUDE, orderBy: [{ createdAt: 'desc' }] });
    }

    const thread = await this.getThreadByLead(dealershipId, leadId!);
    if (!thread) return [];

    return (this.prisma as any).message.findMany({
      where: { dealershipId, threadId: thread.id },
      include: MESSAGE_INCLUDE,
      orderBy: [{ createdAt: 'desc' }]
    });
  }

  async sendMessage(dealershipId: string, leadId: string, actorUserId: string, payload: SendMessageDto) {
    const thread = await this.createOrGetThread(dealershipId, leadId);
    const lead = await this.ensureLeadExists(dealershipId, leadId);
    const direction = payload.direction ?? CommunicationDirection.OUTBOUND;

    let providerMessageId: string | undefined;
    const sentAt = new Date();
    const status = 'SENT';

    if (direction === CommunicationDirection.OUTBOUND && payload.channel === CommunicationChannel.SMS) {
      if (!lead.phone) throw new BadRequestException('Lead is missing phone number for SMS');
      providerMessageId = (await this.smsProvider.send({ to: lead.phone, body: payload.body })).providerMessageId;
    }

    if (direction === CommunicationDirection.OUTBOUND && payload.channel === CommunicationChannel.EMAIL) {
      if (!lead.email) throw new BadRequestException('Lead is missing email for EMAIL');
      providerMessageId = (await this.emailProvider.send({ to: lead.email, subject: payload.subject, body: payload.body })).providerMessageId;
    }

    const message = await (this.prisma as any).message.create({
      data: {
        dealershipId,
        threadId: thread.id,
        channel: payload.channel,
        direction,
        body: payload.body,
        status,
        sentAt,
        actorUserId,
        providerMessageId
      },
      include: MESSAGE_INCLUDE
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: 'message_sent',
      entityType: 'Message',
      entityId: message.id,
      payload: {
        threadId: thread.id,
        leadId,
        channel: message.channel,
        direction: message.direction,
        providerMessageId: providerMessageId ?? null
      }
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'message_sent',
      entityType: 'Message',
      entityId: message.id,
      metadata: { leadId, threadId: thread.id, channel: message.channel, direction: message.direction }
    });

    await this.prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() }, select: { id: true } });

    return message;
  }

  async logCall(dealershipId: string, leadId: string, actorUserId: string, payload: LogCallDto) {
    const thread = await this.createOrGetThread(dealershipId, leadId);
    const lead = await this.ensureLeadExists(dealershipId, leadId);
    const providerResult = await this.telephonyProvider.logCall({
      to: lead.phone ?? 'unknown',
      durationSec: payload.durationSec,
      outcome: payload.outcome,
      notes: payload.body
    });

    const message = await (this.prisma as any).message.create({
      data: {
        dealershipId,
        threadId: thread.id,
        channel: CommunicationChannel.CALL,
        direction: CommunicationDirection.OUTBOUND,
        body: payload.body ?? payload.outcome,
        status: 'LOGGED',
        sentAt: new Date(),
        actorUserId,
        providerMessageId: providerResult.providerMessageId,
        callDurationSec: payload.durationSec,
        callOutcome: payload.outcome
      },
      include: MESSAGE_INCLUDE
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: 'call_logged',
      entityType: 'Message',
      entityId: message.id,
      payload: {
        leadId,
        threadId: thread.id,
        durationSec: payload.durationSec,
        outcome: payload.outcome
      }
    });

    await this.prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() }, select: { id: true } });

    return message;
  }

  listTemplates(dealershipId: string) {
    return (this.prisma as any).communicationTemplate.findMany({
      where: { dealershipId },
      orderBy: [{ createdAt: 'desc' }]
    });
  }

  createTemplate(dealershipId: string, actorUserId: string, payload: CreateTemplateDto) {
    return (this.prisma as any).communicationTemplate.create({
      data: {
        dealershipId,
        channel: payload.channel,
        name: payload.name,
        subject: payload.subject,
        body: payload.body,
        createdBy: actorUserId
      }
    });
  }

  async updateTemplate(dealershipId: string, templateId: string, payload: UpdateTemplateDto) {
    await this.ensureTemplate(dealershipId, templateId);
    return (this.prisma as any).communicationTemplate.update({
      where: { id: templateId },
      data: {
        channel: payload.channel,
        name: payload.name,
        subject: payload.subject,
        body: payload.body
      }
    });
  }

  async deleteTemplate(dealershipId: string, templateId: string) {
    await this.ensureTemplate(dealershipId, templateId);
    await (this.prisma as any).communicationTemplate.delete({ where: { id: templateId } });
    return { ok: true };
  }

  private async ensureLeadExists(dealershipId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, dealershipId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private async ensureThread(dealershipId: string, threadId: string) {
    const thread = await (this.prisma as any).conversationThread.findFirst({ where: { id: threadId, dealershipId } });
    if (!thread) throw new NotFoundException('Thread not found');
    return thread;
  }

  private async ensureTemplate(dealershipId: string, templateId: string) {
    const template = await (this.prisma as any).communicationTemplate.findFirst({
      where: { id: templateId, dealershipId },
      select: { id: true }
    });

    if (!template) throw new NotFoundException('Template not found');
  }
}
