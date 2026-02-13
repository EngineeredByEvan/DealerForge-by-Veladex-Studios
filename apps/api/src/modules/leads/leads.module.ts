import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventLogModule } from '../event-log/event-log.module';
import { AuditModule } from '../audit/audit.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule, AuditModule, EventLogModule],
  controllers: [LeadsController, ActivitiesController],
  providers: [LeadsService, ActivitiesService],
  exports: [LeadsService]
})
export class LeadsModule {}
