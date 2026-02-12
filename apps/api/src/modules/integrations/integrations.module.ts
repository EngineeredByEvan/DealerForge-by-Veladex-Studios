import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [PrismaModule, LeadsModule, AuditModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService]
})
export class IntegrationsModule {}
