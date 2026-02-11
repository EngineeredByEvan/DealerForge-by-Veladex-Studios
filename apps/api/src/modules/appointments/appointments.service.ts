import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto
} from './appointments.dto';

const APPOINTMENT_INCLUDE = {
  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true
    }
  }
} satisfies Prisma.AppointmentInclude;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByDealership(dealershipId: string, query: ListAppointmentsQueryDto) {
    const where: Prisma.AppointmentWhereInput = { dealershipId };

    if (query.range) {
      const parsed = this.parseRange(query.range);
      if (parsed) {
        where.start_at = {
          gte: parsed.start,
          lte: parsed.end
        };
      }
    }

    return this.prisma.appointment.findMany({
      where,
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ start_at: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async createAppointment(dealershipId: string, payload: CreateAppointmentDto) {
    await this.validateLead(dealershipId, payload.lead_id);
    this.validateTimeWindow(payload.start_at, payload.end_at);

    return this.prisma.appointment.create({
      data: {
        dealershipId,
        status: payload.status ?? AppointmentStatus.SET,
        start_at: new Date(payload.start_at),
        end_at: new Date(payload.end_at),
        lead_id: payload.lead_id,
        note: payload.note
      },
      include: APPOINTMENT_INCLUDE
    });
  }

  async updateAppointment(dealershipId: string, appointmentId: string, payload: UpdateAppointmentDto) {
    const appointment = await this.findAppointmentById(dealershipId, appointmentId);

    if (payload.lead_id !== undefined) {
      await this.validateLead(dealershipId, payload.lead_id);
    }

    const startAt = payload.start_at ?? appointment.start_at.toISOString();
    const endAt = payload.end_at ?? appointment.end_at.toISOString();
    this.validateTimeWindow(startAt, endAt);

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: payload.status,
        start_at: payload.start_at ? new Date(payload.start_at) : undefined,
        end_at: payload.end_at ? new Date(payload.end_at) : undefined,
        lead_id: payload.lead_id,
        note: payload.note
      },
      include: APPOINTMENT_INCLUDE
    });
  }

  async confirmAppointment(dealershipId: string, appointmentId: string) {
    const appointment = await this.findAppointmentById(dealershipId, appointmentId);

    if (appointment.status === AppointmentStatus.CANCELED) {
      throw new BadRequestException('Canceled appointments cannot be confirmed');
    }

    if (appointment.status === AppointmentStatus.CONFIRMED) {
      return appointment;
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CONFIRMED
      },
      include: APPOINTMENT_INCLUDE
    });
  }

  async cancelAppointment(dealershipId: string, appointmentId: string) {
    const appointment = await this.findAppointmentById(dealershipId, appointmentId);

    if (appointment.status === AppointmentStatus.SHOWED || appointment.status === AppointmentStatus.NO_SHOW) {
      throw new BadRequestException('Completed appointments cannot be canceled');
    }

    if (appointment.status === AppointmentStatus.CANCELED) {
      return appointment;
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELED
      },
      include: APPOINTMENT_INCLUDE
    });
  }

  private parseRange(range: string): { start: Date; end: Date } | null {
    const [startIso, endIso] = range.split(',').map((value) => value.trim());

    if (!startIso || !endIso) {
      return null;
    }

    const start = new Date(startIso);
    const end = new Date(endIso);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    if (start > end) {
      throw new BadRequestException('range start must be before range end');
    }

    return { start, end };
  }

  private validateTimeWindow(startAt: string, endAt: string): void {
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (start >= end) {
      throw new BadRequestException('startAt must be before endAt');
    }
  }

  private async findAppointmentById(dealershipId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        dealershipId
      },
      include: APPOINTMENT_INCLUDE
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  private async validateLead(dealershipId: string, leadId?: string): Promise<void> {
    if (!leadId) {
      return;
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        dealershipId
      },
      select: { id: true }
    });

    if (!lead) {
      throw new BadRequestException('leadId must belong to the selected dealership');
    }
  }
}
