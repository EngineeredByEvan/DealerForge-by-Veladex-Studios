import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../../common/types/request-context';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto
} from './appointments.dto';
import { AppointmentsService } from './appointments.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  findAll(@Req() req: TenantRequest, @Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.listByDealership(req.tenant!.dealershipId, query);
  }

  @Post()
  create(@Req() req: TenantRequest, @Body() payload: CreateAppointmentDto) {
    return this.appointmentsService.createAppointment(req.tenant!.dealershipId, payload);
  }

  @Patch(':id')
  update(
    @Req() req: TenantRequest,
    @Param('id') appointmentId: string,
    @Body() payload: UpdateAppointmentDto
  ) {
    return this.appointmentsService.updateAppointment(req.tenant!.dealershipId, appointmentId, payload);
  }

  @Post(':id/confirm')
  confirm(@Req() req: TenantRequest, @Param('id') appointmentId: string) {
    return this.appointmentsService.confirmAppointment(req.tenant!.dealershipId, appointmentId);
  }

  @Post(':id/cancel')
  cancel(@Req() req: TenantRequest, @Param('id') appointmentId: string) {
    return this.appointmentsService.cancelAppointment(req.tenant!.dealershipId, appointmentId);
  }
}
