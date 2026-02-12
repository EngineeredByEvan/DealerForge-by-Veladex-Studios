import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  // You can remove PrismaModule entirely for now.
  // This guarantees PrismaService is in the AuditModule DI context.
  providers: [PrismaService, AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
