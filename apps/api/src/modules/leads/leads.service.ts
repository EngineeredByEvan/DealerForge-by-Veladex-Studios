import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, LeadType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventLogService } from '../event-log/event-log.service';
import { AssignLeadDto, CreateLeadDto, ListLeadsQueryDto, UpdateLeadDto } from './leads.dto';
import { LeadScoringService } from './lead-scoring.service';
import { LEAD_SUMMARY_INCLUDE } from './lead-summary';

const LEAD_INCLUDE = {
  assignedToUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  soldByUser: {
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

const MANAGEMENT_ASSIGN_ROLES: Role[] = [Role.ADMIN, Role.MANAGER];
const SOLD_ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.MANAGER];

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventLogService: EventLogService,
    private readonly leadScoringService: LeadScoringService
  ) {}

  async listByDealership(dealershipId: string, query: ListLeadsQueryDto) {
    const where: Prisma.LeadWhereInput = { dealershipId };

    if (query.status) where.status = query.status;
    if (query.leadType) where.leadType = query.leadType;
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
      // Root cause: list rows were hydrated from an include that varied across endpoints,
      // so vehicle/source/score were not guaranteed to be returned to the web app.
      include: LEAD_SUMMARY_INCLUDE,
      orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }]
    });
  }



  async getOptions(dealershipId: string) {
    const assignableMemberships = await this.prisma.userDealershipRole.findMany({
      where: {
        dealershipId,
        isActive: true,
        role: {
          in: [Role.ADMIN, Role.MANAGER, Role.SALES, Role.BDC]
        }
      },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        role: true
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }]
    });

    return {
      statuses: Object.values(LeadStatus),
      leadTypes: Object.values(LeadType),
      assignableUsers: assignableMemberships.map((membership) => ({
        id: membership.user.id,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email,
        role: membership.role
      }))
    };
  }

  async createLead(dealershipId: string, payload: CreateLeadDto, actorUserId?: string, actorRole?: Role) {
    const source = await this.resolveSource(dealershipId, payload.source);

    let assignedToUserId = payload.assignedToUserId;
    if (!assignedToUserId && actorUserId && actorRole === Role.SALES) {
      assignedToUserId = actorUserId;
    }

    await this.validateAssignee(dealershipId, assignedToUserId);

    const created = await this.prisma.lead.create({
      data: {
        dealershipId,
        sourceId: source?.id,
        status: payload.status ?? LeadStatus.NEW,
        leadType: payload.leadType,
        assignedToUserId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        vehicleInterest: payload.vehicleInterest,
        lastActivityAt: payload.lastActivityAt ? new Date(payload.lastActivityAt) : null
      },
      include: LEAD_INCLUDE
    });

    await this.leadScoringService.recalculateAndPersist(created.id, dealershipId);
    const lead = await this.getLeadSummaryOrThrow(dealershipId, created.id);

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


  async listTimeline(dealershipId: string, leadId: string, limit = 5, cursor?: string) {
    await this.ensureLeadExists(dealershipId, leadId);

    const parsedLimit = Math.max(1, Math.min(limit, 25));
    const cursorDate = cursor ? new Date(cursor) : null;
    const createdAtFilter = cursorDate && !Number.isNaN(cursorDate.getTime()) ? { lt: cursorDate } : undefined;

    const [messages, activities, tasks, appointments] = await Promise.all([
      this.prisma.message.findMany({
        where: { dealershipId, thread: { leadId }, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
        orderBy: { createdAt: 'desc' },
        take: parsedLimit
      }),
      this.prisma.activity.findMany({
        where: { leadId, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
        orderBy: { createdAt: 'desc' },
        take: parsedLimit
      }),
      this.prisma.task.findMany({
        where: { dealershipId, leadId, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
        orderBy: { createdAt: 'desc' },
        take: parsedLimit
      }),
      this.prisma.appointment.findMany({
        where: { dealershipId, lead_id: leadId, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
        orderBy: { createdAt: 'desc' },
        take: parsedLimit
      })
    ]);

    const items = [
      ...messages.map((item) => ({ id: item.id, type: 'MESSAGE', occurredAt: item.createdAt, payload: item })),
      ...activities.map((item) => ({ id: item.id, type: 'ACTIVITY', occurredAt: item.createdAt, payload: item })),
      ...tasks.map((item) => ({ id: item.id, type: 'TASK', occurredAt: item.createdAt, payload: item })),
      ...appointments.map((item) => ({ id: item.id, type: 'APPOINTMENT', occurredAt: item.createdAt, payload: item }))
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const page = items.slice(0, parsedLimit);
    const nextCursor = page.length === parsedLimit ? page[page.length - 1].occurredAt.toISOString() : null;

    return { items: page, nextCursor };
  }

  async findById(dealershipId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, dealershipId },
      include: LEAD_SUMMARY_INCLUDE
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async updateLead(dealershipId: string, leadId: string, payload: UpdateLeadDto, actorUserId?: string) {
    const existingLead = await this.ensureLeadExists(dealershipId, leadId);
    const source = await this.resolveSource(dealershipId, payload.source);

    if (payload.assignedToUserId !== undefined) {
      await this.validateAssignee(dealershipId, payload.assignedToUserId);
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: payload.status,
        leadType: payload.leadType,
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

    await this.leadScoringService.recalculateAndPersist(leadId, dealershipId);
    const lead = await this.getLeadSummaryOrThrow(dealershipId, updated.id);

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'lead_updated',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: payload as Prisma.InputJsonValue
    });

    if (payload.status && payload.status !== existingLead.status) {
      await this.eventLogService.emit({
        dealershipId,
        actorUserId,
        eventType: 'lead_status_changed',
        entityType: 'Lead',
        entityId: lead.id,
        payload: { status: lead.status, previousStatus: existingLead.status }
      });
    }

    return lead;
  }

  async assignLead(dealershipId: string, leadId: string, payload: AssignLeadDto, actorUserId?: string, actorRole?: Role) {
    await this.ensureLeadExists(dealershipId, leadId);

    if (actorRole === Role.SALES) {
      if (payload.assignedToUserId !== actorUserId) {
        throw new ForbiddenException('Sales users can only assign leads to themselves');
      }
    } else if (!actorRole || !MANAGEMENT_ASSIGN_ROLES.includes(actorRole)) {
      throw new ForbiddenException('Only admin/manager can assign leads');
    }

    await this.validateAssignee(dealershipId, payload.assignedToUserId);

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToUserId: payload.assignedToUserId ?? null,
        lastActivityAt: new Date()
      },
      include: LEAD_INCLUDE
    });

    await this.leadScoringService.recalculateAndPersist(leadId, dealershipId);
    const lead = await this.getLeadSummaryOrThrow(dealershipId, updated.id);

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
      payload: { assignedToUserId: payload.assignedToUserId ?? null }
    });

    return lead;
  }

  async updateStatus(dealershipId: string, leadId: string, status: LeadStatus, actorUserId?: string, actorRole?: Role) {
    const existingLead = await this.ensureLeadExists(dealershipId, leadId);

    const isSold = status === LeadStatus.SOLD;
    if (isSold && (!actorRole || !SOLD_ALLOWED_ROLES.includes(actorRole))) {
      throw new ForbiddenException('Only admin/manager can mark a lead as sold');
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status,
        soldAt: isSold ? new Date() : null,
        soldByUserId: isSold ? actorUserId : null,
        lastActivityAt: new Date()
      },
      include: LEAD_INCLUDE
    });

    await this.leadScoringService.recalculateAndPersist(leadId, dealershipId);
    const lead = await this.getLeadSummaryOrThrow(dealershipId, updated.id);

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'lead_status_changed',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: { status }
    });

    if (existingLead.status !== status) {
      await this.eventLogService.emit({
        dealershipId,
        actorUserId,
        eventType: 'lead_status_changed',
        entityType: 'Lead',
        entityId: lead.id,
        payload: { status, previousStatus: existingLead.status }
      });
    }

    return lead;
  }

  private async ensureLeadExists(dealershipId: string, leadId: string): Promise<{ id: string; status: LeadStatus }> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, dealershipId }, select: { id: true, status: true } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private parseDateRange(dateRange?: string): { start: Date; end: Date } | null {
    if (!dateRange) return null;

    const presets: Record<string, { start: Date; end: Date }> = {
      TODAY: { start: new Date(new Date().setHours(0, 0, 0, 0)), end: new Date(new Date().setHours(23, 59, 59, 999)) },
      THIS_WEEK: { start: new Date(new Date(Date.now() - 6 * 24 * 3600_000).setHours(0, 0, 0, 0)), end: new Date(new Date().setHours(23, 59, 59, 999)) },
      THIS_MONTH: { start: new Date(new Date(Date.now() - 29 * 24 * 3600_000).setHours(0, 0, 0, 0)), end: new Date(new Date().setHours(23, 59, 59, 999)) }
    };

    if (presets[dateRange]) return presets[dateRange];

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
      where: { dealershipId, userId: assignedToUserId, isActive: true },
      select: { id: true }
    });

    if (!membership) {
      throw new BadRequestException('assignedToUserId must belong to the selected dealership');
    }
  }

  async getLeadSummaryOrThrow(dealershipId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, dealershipId },
      include: LEAD_SUMMARY_INCLUDE
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }
}
