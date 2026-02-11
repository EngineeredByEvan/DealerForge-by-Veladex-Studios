import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, LeadsService, PrismaService]
})
export class IntegrationsModule {}
