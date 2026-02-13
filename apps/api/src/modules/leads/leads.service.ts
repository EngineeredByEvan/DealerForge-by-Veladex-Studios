import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventLogService } from '../event-log/event-log.service';
import { AssignLeadDto, CreateLeadDto, ListLeadsQueryDto, UpdateLeadDto } from './leads.dto';

const LEAD_INCLUDE = {
  assignedToUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  source: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventLogService: EventLogService
  ) {}

  async listByDealership(dealershipId: string, query: ListLeadsQueryDto) {
    const where: Prisma.LeadWhereInput = { dealershipId };

    if (query.status) where.status = query.status;
    if (query.assignedTo) where.assignedToUserId = query.assignedTo;

    if (query.source) {
      where.source = { name: { equals: query.source, mode: 'insensitive' } };
    }

    if (query.q) {
      where.OR = [
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } },
        { vehicleInterest: { contains: query.q, mode: 'insensitive' } }
      ];
    }

    const dateRange = this.parseDateRange(query.dateRange);
    if (dateRange) {
      where.createdAt = { gte: dateRange.start, lte: dateRange.end };
    }

    return this.prisma.lead.findMany({
      where,
      include: LEAD_INCLUDE,
      orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createLead(dealershipId: string, payload: CreateLeadDto, actorUserId?: string) {
    const source = await this.resolveSource(dealershipId, payload.source);
    await this.validateAssignee(dealershipId, payload.assignedToUserId);

    const lead = await this.prisma.lead.create({
      data: {
        dealershipId,
        sourceId: source?.id,
        status: payload.status ?? LeadStatus.NEW,
        assignedToUserId: payload.assignedToUserId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        vehicleInterest: payload.vehicleInterest,
        lastActivityAt: payload.lastActivityAt ? new Date(payload.lastActivityAt) : null
      },
      include: LEAD_INCLUDE
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'lead_created',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: { status: lead.status, source: payload.source ?? null }
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: 'lead_created',
      entityType: 'Lead',
      entityId: lead.id,
      payload: { status: lead.status, assignedToUserId: lead.assignedToUserId, source: payload.source ?? null }
    });

    if (lead.assignedToUserId) {
      await this.eventLogService.emit({
        dealershipId,
        actorUserId,
        eventType: 'lead_assigned',
        entityType: 'Lead',
        entityId: lead.id,
        payload: { assignedToUserId: lead.assignedToUserId }
      });
    }

    return lead;
  }

  async findById(dealershipId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, dealershipId },
      include: LEAD_INCLUDE
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async updateLead(dealershipId: string, leadId: string, payload: UpdateLeadDto, actorUserId?: string) {
    await this.ensureLeadExists(dealershipId, leadId);
    const source = await this.resolveSource(dealershipId, payload.source);

    if (payload.assignedToUserId !== undefined) {
      await this.validateAssignee(dealershipId, payload.assignedToUserId);
    }

    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: payload.status,
        sourceId: payload.source !== undefined ? source?.id ?? null : undefined,
        assignedToUserId: payload.assignedToUserId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        vehicleInterest: payload.vehicleInterest,
        lastActivityAt: payload.lastActivityAt ? new Date(payload.lastActivityAt) : undefined
      },
      include: LEAD_INCLUDE
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'lead_updated',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: payload as Prisma.InputJsonValue
    });

    return lead;
  }

  async assignLead(dealershipId: string, leadId: string, payload: AssignLeadDto, actorUserId?: string) {
    await this.ensureLeadExists(dealershipId, leadId);
    await this.validateAssignee(dealershipId, payload.assignedToUserId);

    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToUserId: payload.assignedToUserId,
        lastActivityAt: new Date()
      },
      include: LEAD_INCLUDE
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'lead_assigned',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: { assignedToUserId: payload.assignedToUserId }
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: 'lead_assigned',
      entityType: 'Lead',
      entityId: lead.id,
      payload: { assignedToUserId: payload.assignedToUserId }
    });

    return lead;
  }

  async updateStatus(dealershipId: string, leadId: string, status: LeadStatus, actorUserId?: string) {
    await this.ensureLeadExists(dealershipId, leadId);

    const lead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status,
        lastActivityAt: new Date()
      },
      include: LEAD_INCLUDE
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'lead_status_changed',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: { status }
    });

    return lead;
  }

  private async ensureLeadExists(dealershipId: string, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, dealershipId }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');
  }

  private parseDateRange(dateRange?: string): { start: Date; end: Date } | null {
    if (!dateRange) return null;

    const parts = dateRange.split(',').map((part) => part.trim());
    if (parts.length !== 2) {
      throw new BadRequestException('dateRange must use format "start,end" with ISO timestamps');
    }

    const [startRaw, endRaw] = parts;
    const start = new Date(startRaw);
    const end = new Date(endRaw);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('dateRange must contain valid ISO timestamps');
    }

    return { start, end };
  }

  private async resolveSource(dealershipId: string, sourceName?: string) {
    if (!sourceName) return null;

    return this.prisma.leadSource.upsert({
      where: { dealershipId_name: { dealershipId, name: sourceName } },
      update: {},
      create: { dealershipId, name: sourceName }
    });
  }

  private async validateAssignee(dealershipId: string, assignedToUserId?: string): Promise<void> {
    if (!assignedToUserId) return;

    const membership = await this.prisma.userDealershipRole.findFirst({
      where: { dealershipId, userId: assignedToUserId },
      select: { id: true }
    });

    if (!membership) {
      throw new BadRequestException('assignedToUserId must belong to the selected dealership');
    }
  }
}
