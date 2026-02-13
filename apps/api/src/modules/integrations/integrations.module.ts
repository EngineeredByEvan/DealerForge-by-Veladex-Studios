import { Module } from '@nestjs/common';
import { PlatformOrDealershipAdminGuard } from '../../common/guards/platform-or-dealership-admin.guard';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventLogModule } from '../event-log/event-log.module';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [PrismaModule, LeadsModule, AuditModule, EventLogModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, PlatformOrDealershipAdminGuard]
})
export class IntegrationsModule {}
