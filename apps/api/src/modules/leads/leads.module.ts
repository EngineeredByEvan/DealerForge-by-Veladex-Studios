import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController, ActivitiesController],
  providers: [LeadsService, ActivitiesService, PrismaService]
})
export class LeadsModule {}
