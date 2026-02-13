import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  QueryBreakdownDto,
  QueryEventLogsDto,
  QuerySummaryDto,
  QueryTrendsDto,
  ReportDimension
} from './reports.dto';

type LeadSnapshot = {
  leadId: string;
  source: string | null;
  assignedUserId: string | null;
  status: string | null;
  leadType: string | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(dealershipId: string, query: QuerySummaryDto) {
    const range = this.parseDateRange(query.start, query.end);
    const leads = await this.getFilteredLeads(dealershipId, range, query);
    const leadIds = new Set(leads.map((lead) => lead.leadId));

    const appointmentCreated = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'appointment_created'
      },
      select: {
        entityId: true,
        payload: true,
        occurredAt: true
      }
    });

    const appointmentLeadMap = new Map<string, string>();
    for (const event of appointmentCreated) {
      const leadId = this.readPayloadString(event.payload, 'leadId');
      if (leadId) {
        appointmentLeadMap.set(event.entityId, leadId);
      }
    }

    const appointmentsSet = appointmentCreated.filter((event) => {
      const leadId = appointmentLeadMap.get(event.entityId);
      return Boolean(leadId && leadIds.has(leadId) && this.inRange(event.occurredAt, range));
    }).length;

    const showEvents = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'appointment_status_changed',
        occurredAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        entityId: true,
        payload: true
      }
    });

    const showedIds = new Set(
      showEvents
        .filter((event) => this.readPayloadString(event.payload, 'status') === 'SHOWED')
        .filter((event) => {
          const leadId = appointmentLeadMap.get(event.entityId);
          return Boolean(leadId && leadIds.has(leadId));
        })
        .map((event) => event.entityId)
    );

    const soldEvents = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'lead_status_changed',
        occurredAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        entityId: true,
        payload: true
      }
    });

    const soldLeadIds = new Set(
      soldEvents
        .filter((event) => this.readPayloadString(event.payload, 'status') === 'SOLD')
        .filter((event) => leadIds.has(event.entityId))
        .map((event) => event.entityId)
    );

    return this.toSummary(leads.length, appointmentsSet, showedIds.size, soldLeadIds.size);
  }

  async getBreakdown(dealershipId: string, query: QueryBreakdownDto) {
    const range = this.parseDateRange(query.start, query.end);
    const leads = await this.getFilteredLeads(dealershipId, range, query);

    const groups = new Map<string, Set<string>>();

    for (const lead of leads) {
      const key = this.getLeadDimensionValue(lead, query.dimension);
      const ids = groups.get(key) ?? new Set<string>();
      ids.add(lead.leadId);
      groups.set(key, ids);
    }

    const entries = await Promise.all(
      Array.from(groups.entries()).map(async ([key, leadIdSet]) => {
        const summary = await this.computeSummaryForLeadIds(dealershipId, range, leadIdSet);

        return {
          key,
          ...summary
        };
      })
    );

    return entries.sort((a, b) => b.total_leads - a.total_leads || a.key.localeCompare(b.key));
  }

  async getTrends(dealershipId: string, query: QueryTrendsDto) {
    const range = this.parseDateRange(query.start, query.end);
    const leads = await this.getFilteredLeads(dealershipId, range, query);
    const leadIds = new Set(leads.map((lead) => lead.leadId));

    if (!leadIds.size) {
      return [];
    }


    const appointmentCreated = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'appointment_created'
      },
      select: {
        entityId: true,
        payload: true,
        occurredAt: true
      }
    });

    const appointmentLeadMap = new Map<string, string>();
    for (const event of appointmentCreated) {
      const leadId = this.readPayloadString(event.payload, 'leadId');
      if (leadId) {
        appointmentLeadMap.set(event.entityId, leadId);
      }
    }

    if (query.metric === 'appointments') {
      const values = appointmentCreated
        .filter((event) => {
          const leadId = appointmentLeadMap.get(event.entityId);
          return Boolean(leadId && leadIds.has(leadId) && this.inRange(event.occurredAt, range));
        })
        .map((event) => event.occurredAt);

      return this.bucketTimeSeries(values);
    }

    if (query.metric === 'sold') {
      const soldEvents = await this.prisma.eventLog.findMany({
        where: {
          dealershipId,
          eventType: 'lead_status_changed',
          occurredAt: {
            gte: range.start,
            lte: range.end
          }
        },
        select: {
          entityId: true,
          payload: true,
          occurredAt: true
        }
      });

      const values = soldEvents
        .filter((event) => this.readPayloadString(event.payload, 'status') === 'SOLD')
        .filter((event) => leadIds.has(event.entityId))
        .map((event) => event.occurredAt);

      return this.bucketTimeSeries(values);
    }

    const values = leads.map((lead) => lead.createdAt);
    return this.bucketTimeSeries(values);
  }

  async listEventLogs(dealershipId: string, query: QueryEventLogsDto) {
    const startAt = query.startAt ? new Date(query.startAt) : undefined;
    const endAt = query.endAt ? new Date(query.endAt) : undefined;

    if (startAt && endAt && startAt > endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    return this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: query.eventType || undefined,
        entityType: query.entityType || undefined,
        occurredAt:
          startAt || endAt
            ? {
                gte: startAt,
                lte: endAt
              }
            : undefined
      },
      orderBy: { occurredAt: 'desc' },
      take: 200
    });
  }

  private async getFilteredLeads(
    dealershipId: string,
    range: { start: Date; end: Date },
    query: { source?: string; assignedUser?: string; status?: string; leadType?: string }
  ): Promise<Array<LeadSnapshot & { createdAt: Date }>> {
    const leadEvents = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'lead_created',
        occurredAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        entityId: true,
        payload: true,
        occurredAt: true
      },
      orderBy: {
        occurredAt: 'asc'
      }
    });

    const snapshots = new Map<string, LeadSnapshot & { createdAt: Date }>();
    for (const event of leadEvents) {
      if (!snapshots.has(event.entityId)) {
        snapshots.set(event.entityId, {
          leadId: event.entityId,
          source: this.readPayloadString(event.payload, 'source'),
          assignedUserId: this.readPayloadString(event.payload, 'assignedToUserId'),
          status: this.readPayloadString(event.payload, 'status'),
          leadType: this.readPayloadString(event.payload, 'leadType'),
          createdAt: event.occurredAt
        });
      }
    }

    return Array.from(snapshots.values()).filter((lead) => {
      if (query.source && !this.equalsIgnoreCase(lead.source, query.source)) return false;
      if (query.assignedUser && lead.assignedUserId !== query.assignedUser) return false;
      if (query.status && !this.equalsIgnoreCase(lead.status, query.status)) return false;
      if (query.leadType && !this.equalsIgnoreCase(lead.leadType, query.leadType)) return false;
      return true;
    });
  }

  private async computeSummaryForLeadIds(dealershipId: string, range: { start: Date; end: Date }, leadIdSet: Set<string>) {
    if (!leadIdSet.size) {
      return this.toSummary(0, 0, 0, 0);
    }

    const appointmentCreated = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'appointment_created'
      },
      select: {
        entityId: true,
        payload: true,
        occurredAt: true
      }
    });

    const appointmentLeadMap = new Map<string, string>();
    for (const event of appointmentCreated) {
      const leadId = this.readPayloadString(event.payload, 'leadId');
      if (leadId) {
        appointmentLeadMap.set(event.entityId, leadId);
      }
    }

    const appointmentsSet = appointmentCreated.filter((event) => {
      const leadId = appointmentLeadMap.get(event.entityId);
      return Boolean(leadId && leadIdSet.has(leadId) && this.inRange(event.occurredAt, range));
    }).length;

    const showEvents = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'appointment_status_changed',
        occurredAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        entityId: true,
        payload: true
      }
    });

    const showedIds = new Set(
      showEvents
        .filter((event) => this.readPayloadString(event.payload, 'status') === 'SHOWED')
        .filter((event) => {
          const leadId = appointmentLeadMap.get(event.entityId);
          return Boolean(leadId && leadIdSet.has(leadId));
        })
        .map((event) => event.entityId)
    );

    const soldEvents = await this.prisma.eventLog.findMany({
      where: {
        dealershipId,
        eventType: 'lead_status_changed',
        occurredAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        entityId: true,
        payload: true
      }
    });

    const soldLeadIds = new Set(
      soldEvents
        .filter((event) => this.readPayloadString(event.payload, 'status') === 'SOLD')
        .filter((event) => leadIdSet.has(event.entityId))
        .map((event) => event.entityId)
    );

    return this.toSummary(leadIdSet.size, appointmentsSet, showedIds.size, soldLeadIds.size);
  }

  private getLeadDimensionValue(lead: LeadSnapshot, dimension: ReportDimension): string {
    if (dimension === 'source') {
      return lead.source ?? 'Unspecified';
    }

    if (dimension === 'assignedUser') {
      return lead.assignedUserId ?? 'Unassigned';
    }

    return lead.status ?? 'Unspecified';
  }

  private parseDateRange(start?: string, end?: string) {
    if (!start || !end) {
      throw new BadRequestException('start and end are required');
    }

    const parsedStart = new Date(start);
    const parsedEnd = new Date(end);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      throw new BadRequestException('start and end must be valid ISO dates');
    }

    if (parsedStart > parsedEnd) {
      throw new BadRequestException('start must be before end');
    }

    return { start: parsedStart, end: parsedEnd };
  }

  private readPayloadString(payload: Prisma.JsonValue | null, key: string): string | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const value = (payload as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private equalsIgnoreCase(value: string | null, target: string): boolean {
    return (value ?? '').toLowerCase() === target.toLowerCase();
  }

  private inRange(value: Date, range: { start: Date; end: Date }): boolean {
    return value >= range.start && value <= range.end;
  }

  private bucketTimeSeries(values: Date[]) {
    const map = new Map<string, number>();

    for (const value of values) {
      const bucket = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())).toISOString();
      map.set(bucket, (map.get(bucket) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, value: count }));
  }

  private toSummary(totalLeads: number, appointmentsSet: number, appointmentsShowed: number, soldCount: number) {
    return {
      total_leads: totalLeads,
      appointments_set: appointmentsSet,
      appointments_showed: appointmentsShowed,
      show_rate: this.toRate(appointmentsShowed, appointmentsSet),
      appointment_rate: this.toRate(appointmentsSet, totalLeads),
      sold_count: soldCount,
      close_rate: this.toRate(soldCount, totalLeads)
    };
  }

  private toRate(numerator: number, denominator: number): number {
    if (denominator <= 0) {
      return 0;
    }

    return Number((numerator / denominator).toFixed(4));
  }
}
