import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EventLogService } from './event-log.service';

@Module({
  imports: [PrismaModule],
  providers: [EventLogService],
  exports: [EventLogService]
})
export class EventLogModule {}
