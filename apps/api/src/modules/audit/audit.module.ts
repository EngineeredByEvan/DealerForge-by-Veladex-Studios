import { Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  // You can remove PrismaModule entirely for now.
  // This guarantees PrismaService is in the AuditModule DI context.
  providers: [PrismaService, AuditService],
  controllers: [AuditController],
  providers: [
    {
      provide: AuditService,
      inject: [ModuleRef],
      useFactory: (moduleRef: ModuleRef) => {
        const prisma = moduleRef.get(PrismaService, { strict: false });
        const mode = prisma ? 'PRISMA' : 'NOOP';
        console.log(`AuditService running in ${mode} mode`);

        return new AuditService(prisma ?? null, mode);
      }
    }
  ],
  exports: [AuditService]
})
export class AuditModule {}
