import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MessageStatus, Prisma } from '@prisma/client';
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
import { CommunicationChannel, CommunicationDirection, CreateTemplateDto, LogCallDto, SendLeadSmsDto, SendMessageDto, UpdateTemplateDto } from './communications.dto';

const MESSAGE_INCLUDE = {
  actorUser: {
    select: { id: true, firstName: true, lastName: true, email: true }
  },
  thread: {
    select: { id: true, leadId: true }
  }
} satisfies Prisma.MessageInclude;

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

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

  async sendLeadSms(dealershipId: string, leadId: string, actorUserId: string, payload: SendLeadSmsDto) {
    const thread = await this.createOrGetThread(dealershipId, leadId);
    const lead = await this.ensureLeadExists(dealershipId, leadId);
    const toPhone = payload.toPhone ?? lead.phone;
    if (!toPhone) throw new BadRequestException('Lead is missing phone number for SMS');
    if (!E164_REGEX.test(toPhone)) throw new BadRequestException('SMS toPhone must be E.164 format');

    const message = await (this.prisma as any).message.create({
      data: {
        dealershipId,
        threadId: thread.id,
        channel: CommunicationChannel.SMS,
        direction: CommunicationDirection.OUTBOUND,
        body: payload.body,
        status: MessageStatus.QUEUED,
        actorUserId,
        provider: process.env.COMMUNICATIONS_MODE === 'twilio' ? 'twilio' : 'mock',
        toPhone
      },
      include: MESSAGE_INCLUDE
    });

    const result = await this.smsProvider.send({ dealershipId, to: toPhone, body: payload.body });

    const updated = await (this.prisma as any).message.update({
      where: { id: message.id },
      data: {
        status: result.status === 'SENT' ? MessageStatus.SENT : MessageStatus.FAILED,
        sentAt: result.status === 'SENT' ? new Date() : null,
        providerMessageId: result.providerMessageId,
        fromPhone: result.fromPhone,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      },
      include: MESSAGE_INCLUDE
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: result.status === 'SENT' ? 'sms_sent' : 'sms_failed',
      entityType: 'Message',
      entityId: updated.id,
      payload: {
        threadId: thread.id,
        leadId,
        channel: updated.channel,
        direction: updated.direction,
        providerMessageId: result.providerMessageId
      }
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'sms_sent',
      entityType: 'Message',
      entityId: updated.id,
      metadata: { leadId, threadId: thread.id, channel: updated.channel, direction: updated.direction }
    });

    await this.prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() }, select: { id: true } });

    return updated;
  }

  async recordInboundSms(input: {
    dealershipId: string;
    fromPhone: string;
    toPhone?: string;
    providerMessageId?: string;
    body: string;
  }) {
    const lead = await this.prisma.lead.findFirst({ where: { dealershipId: input.dealershipId, phone: input.fromPhone } })
      ?? await this.prisma.lead.create({
        data: {
          dealershipId: input.dealershipId,
          phone: input.fromPhone,
          status: 'NEW'
        }
      });

    const thread = await this.createOrGetThread(input.dealershipId, lead.id);

    const message = await (this.prisma as any).message.create({
      data: {
        dealershipId: input.dealershipId,
        threadId: thread.id,
        channel: CommunicationChannel.SMS,
        direction: CommunicationDirection.INBOUND,
        body: input.body,
        status: MessageStatus.RECEIVED,
        provider: 'twilio',
        providerMessageId: input.providerMessageId,
        toPhone: input.toPhone,
        fromPhone: input.fromPhone,
        sentAt: new Date()
      },
      include: MESSAGE_INCLUDE
    });

    await this.eventLogService.emit({
      dealershipId: input.dealershipId,
      eventType: 'sms_received',
      entityType: 'Message',
      entityId: message.id,
      payload: { leadId: lead.id, threadId: thread.id }
    });

    return message;
  }

  async updateMessageStatusByProviderMessageId(providerMessageId: string, providerStatus: string, errorCode?: string, errorMessage?: string) {
    const normalized = providerStatus.toLowerCase();
    const status = normalized.includes('deliver') ? MessageStatus.DELIVERED : normalized.includes('fail') || normalized.includes('undeliver') ? MessageStatus.FAILED : MessageStatus.SENT;

    return (this.prisma as any).message.updateMany({
      where: { providerMessageId },
      data: {
        status,
        errorCode,
        errorMessage
      }
    });
  }

  findDealershipByTwilioRouting(params: { toPhone?: string; messagingServiceSid?: string }) {
    const orConditions = [
      params.messagingServiceSid ? { twilioMessagingServiceSid: params.messagingServiceSid } : undefined,
      params.toPhone ? { twilioFromPhone: params.toPhone } : undefined
    ].filter(Boolean) as Prisma.DealershipWhereInput[];

    if (orConditions.length === 0) return null;

    return this.prisma.dealership.findFirst({
      where: { OR: orConditions },
      select: { id: true }
    });
  }

  async sendMessage(dealershipId: string, leadId: string, actorUserId: string, payload: SendMessageDto) {
    const thread = await this.createOrGetThread(dealershipId, leadId);
    const lead = await this.ensureLeadExists(dealershipId, leadId);
    const direction = payload.direction ?? CommunicationDirection.OUTBOUND;

    let providerMessageId: string | undefined;
    const sentAt = new Date();
    const status = MessageStatus.SENT;

    if (direction === CommunicationDirection.OUTBOUND && payload.channel === CommunicationChannel.SMS) {
      if (!lead.phone) throw new BadRequestException('Lead is missing phone number for SMS');
      providerMessageId = (await this.smsProvider.send({ dealershipId, to: lead.phone, body: payload.body })).providerMessageId;
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
        status: MessageStatus.SENT,
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
