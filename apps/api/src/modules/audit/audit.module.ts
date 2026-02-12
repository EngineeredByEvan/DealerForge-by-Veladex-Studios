import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  // You can remove PrismaModule entirely for now.
  // This guarantees PrismaService is in the AuditModule DI context.
  providers: [PrismaService, AuditService],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService]
})
export class AuditModule {}
