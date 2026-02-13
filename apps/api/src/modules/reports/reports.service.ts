import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentStatus, LeadStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueryEventLogsDto } from './reports.dto';

type RangeWindow = {
  start: Date;
  end: Date;
};

type PeriodKey = 'today' | 'week' | 'month';

type Counts = {
  leads: number;
  appointments: number;
  shows: number;
  sold: number;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(dealershipId: string) {
    const now = new Date();

    const windows: Record<PeriodKey, RangeWindow> = {
      today: this.getTodayWindow(now),
      week: this.getWeekWindow(now),
      month: this.getMonthWindow(now)
    };

    const periods = await Promise.all(
      (Object.keys(windows) as PeriodKey[]).map(async (period) => {
        const window = windows[period];

        const [leads, appointments, shows, sold] = await Promise.all([
          this.prisma.lead.count({
            where: {
              dealershipId,
              createdAt: {
                gte: window.start,
                lte: window.end
              }
            }
          }),
          this.prisma.appointment.count({
            where: {
              dealershipId,
              createdAt: {
                gte: window.start,
                lte: window.end
              }
            }
          }),
          this.prisma.appointment.count({
            where: {
              dealershipId,
              status: AppointmentStatus.SHOWED,
              createdAt: {
                gte: window.start,
                lte: window.end
              }
            }
          }),
          this.prisma.lead.count({
            where: {
              dealershipId,
              status: LeadStatus.SOLD,
              createdAt: {
                gte: window.start,
                lte: window.end
              }
            }
          })
        ]);

        return [period, { leads, appointments, shows, sold } satisfies Counts] as const;
      })
    );

    return {
      today: periods.find(([period]) => period === 'today')![1],
      week: periods.find(([period]) => period === 'week')![1],
      month: periods.find(([period]) => period === 'month')![1]
    };
  }

  async getResponseTime(dealershipId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { dealershipId },
      select: { id: true, createdAt: true }
    });

    if (!leads.length) {
      return {
        averageMinutes: null,
        sampleSize: 0
      };
    }

    const firstActivities = await Promise.all(
      leads.map(async (lead) => {
        const activity = await this.prisma.activity.findFirst({
          where: { leadId: lead.id },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true }
        });

        if (!activity) {
          return null;
        }

        const diffMs = activity.createdAt.getTime() - lead.createdAt.getTime();
        return Math.max(0, diffMs / 60000);
      })
    );

    const validDiffs = firstActivities.filter((value): value is number => value !== null);

    if (!validDiffs.length) {
      return {
        averageMinutes: null,
        sampleSize: 0
      };
    }

    const averageMinutes = validDiffs.reduce((sum, value) => sum + value, 0) / validDiffs.length;

    return {
      averageMinutes: Number(averageMinutes.toFixed(2)),
      sampleSize: validDiffs.length
    };
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
  private getTodayWindow(now: Date): RangeWindow {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);

    return { start, end };
  }

  private getWeekWindow(now: Date): RangeWindow {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setMilliseconds(end.getMilliseconds() - 1);

    return { start, end };
  }

  private getMonthWindow(now: Date): RangeWindow {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    end.setMilliseconds(end.getMilliseconds() - 1);

    return { start, end };
  }
}
