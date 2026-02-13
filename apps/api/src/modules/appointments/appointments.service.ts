import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventLogService } from '../event-log/event-log.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventLogService: EventLogService
  ) {}

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

  async createAppointment(dealershipId: string, payload: CreateAppointmentDto, actorUserId?: string) {
    await this.validateLead(dealershipId, payload.lead_id);
    this.validateTimeWindow(payload.start_at, payload.end_at);

    const appointment = await this.prisma.appointment.create({
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

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'appointment_created',
      entityType: 'Appointment',
      entityId: appointment.id,
      metadata: { status: appointment.status, leadId: appointment.lead_id }
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: 'appointment_created',
      entityType: 'Appointment',
      entityId: appointment.id,
      payload: { status: appointment.status, leadId: appointment.lead_id }
    });

    return appointment;
  }

  async updateAppointment(
    dealershipId: string,
    appointmentId: string,
    payload: UpdateAppointmentDto,
    actorUserId?: string
  ) {
    const existingAppointment = await this.findAppointmentById(dealershipId, appointmentId);

    if (payload.lead_id !== undefined) {
      await this.validateLead(dealershipId, payload.lead_id);
    }

    const startAt = payload.start_at ?? existingAppointment.start_at.toISOString();
    const endAt = payload.end_at ?? existingAppointment.end_at.toISOString();
    this.validateTimeWindow(startAt, endAt);

    const appointment = await this.prisma.appointment.update({
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

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'appointment_updated',
      entityType: 'Appointment',
      entityId: appointment.id,
      metadata: payload as Prisma.InputJsonValue
    });

    if (
      appointment.status === AppointmentStatus.CONFIRMED ||
      appointment.status === AppointmentStatus.CANCELED ||
      appointment.status === AppointmentStatus.SHOWED ||
      appointment.status === AppointmentStatus.NO_SHOW
    ) {
      await this.eventLogService.emit({
        dealershipId,
        actorUserId,
        eventType: 'appointment_status_changed',
        entityType: 'Appointment',
        entityId: appointment.id,
        payload: { status: appointment.status }
      });
    }

    return appointment;
  }

  async confirmAppointment(dealershipId: string, appointmentId: string, actorUserId?: string) {
    const existingAppointment = await this.findAppointmentById(dealershipId, appointmentId);

    if (existingAppointment.status === AppointmentStatus.CANCELED) {
      throw new BadRequestException('Canceled appointments cannot be confirmed');
    }

    if (existingAppointment.status === AppointmentStatus.CONFIRMED) {
      return existingAppointment;
    }

    const appointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CONFIRMED
      },
      include: APPOINTMENT_INCLUDE
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'appointment_confirmed',
      entityType: 'Appointment',
      entityId: appointment.id
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: 'appointment_status_changed',
      entityType: 'Appointment',
      entityId: appointment.id,
      payload: { status: appointment.status }
    });

    return appointment;
  }

  async cancelAppointment(dealershipId: string, appointmentId: string, actorUserId?: string) {
    const existingAppointment = await this.findAppointmentById(dealershipId, appointmentId);

    if (
      existingAppointment.status === AppointmentStatus.SHOWED ||
      existingAppointment.status === AppointmentStatus.NO_SHOW
    ) {
      throw new BadRequestException('Completed appointments cannot be canceled');
    }

    if (existingAppointment.status === AppointmentStatus.CANCELED) {
      return existingAppointment;
    }

    const appointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELED
      },
      include: APPOINTMENT_INCLUDE
    });

    await this.auditService.logEvent({
      dealershipId,
      actor: { userId: actorUserId },
      action: 'appointment_canceled',
      entityType: 'Appointment',
      entityId: appointment.id
    });

    await this.eventLogService.emit({
      dealershipId,
      actorUserId,
      eventType: 'appointment_status_changed',
      entityType: 'Appointment',
      entityId: appointment.id,
      payload: { status: appointment.status }
    });

    return appointment;
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
