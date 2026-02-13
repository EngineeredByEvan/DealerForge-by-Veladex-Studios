import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventLogModule } from '../event-log/event-log.module';
import { AuditModule } from '../audit/audit.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadScoringService } from './lead-scoring.service';

@Module({
  imports: [PrismaModule, AuditModule, EventLogModule],
  controllers: [LeadsController, ActivitiesController],
  providers: [LeadsService, ActivitiesService, LeadScoringService],
  exports: [LeadsService, LeadScoringService]
})
export class LeadsModule {}
