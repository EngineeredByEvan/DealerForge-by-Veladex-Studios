import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventLogModule } from '../event-log/event-log.module';
import { AuditModule } from '../audit/audit.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule, AuditModule, EventLogModule],
  controllers: [TasksController],
  providers: [TasksService]
})
export class TasksModule {}
