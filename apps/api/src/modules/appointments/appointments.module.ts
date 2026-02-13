import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventLogModule } from '../event-log/event-log.module';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [PrismaModule, AuditModule, EventLogModule, LeadsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService]
})
export class AppointmentsModule {}
