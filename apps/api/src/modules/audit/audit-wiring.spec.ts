import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiModule } from '../ai/ai.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LeadsModule } from '../leads/leads.module';
import { TasksModule } from '../tasks/tasks.module';
import { AuditModule } from './audit.module';
import { AuditService } from './audit.service';

const MODULE_IMPORTS_METADATA = 'imports';

const modulesUsingAuditService = [
  AiModule,
  AppointmentsModule,
  IntegrationsModule,
  LeadsModule,
  TasksModule
] as const;

describe('Audit and Prisma module wiring', () => {
  it('keeps PrismaService provided and exported by PrismaModule', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PrismaModule) as unknown[];
    const exportsMetadata = Reflect.getMetadata(MODULE_METADATA.EXPORTS, PrismaModule) as unknown[];

    expect(providers).toContain(PrismaService);
    expect(exportsMetadata).toContain(PrismaService);
  });

  it('keeps PrismaModule imported by AuditModule', () => {
    const imports = Reflect.getMetadata(MODULE_IMPORTS_METADATA, AuditModule) as unknown[];

    expect(imports).toContain(PrismaModule);
  });

  it('keeps AuditModule imported by modules that inject AuditService', () => {
    for (const moduleType of modulesUsingAuditService) {
      const imports = Reflect.getMetadata(MODULE_IMPORTS_METADATA, moduleType) as unknown[];

      expect(imports).toContain(AuditModule);
    }
  });


  it('keeps PrismaModule imported by AppModule', () => {
    const imports = Reflect.getMetadata(MODULE_IMPORTS_METADATA, AppModule) as unknown[];

    expect(imports).toContain(PrismaModule);
  });

  it('does not place AuditService in any module imports array', () => {
    for (const moduleType of [AuditModule, ...modulesUsingAuditService, AppModule]) {
      const imports = (Reflect.getMetadata(MODULE_IMPORTS_METADATA, moduleType) as unknown[]) ?? [];

      expect(imports).not.toContain(AuditService);
    }
  });

  it('bootstraps AppModule without DI errors for AuditService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef.get(AppModule)).toBeDefined();
    expect(moduleRef.get(AuditService)).toBeDefined();
    expect(moduleRef.get(PrismaService)).toBeDefined();

    await moduleRef.close();
  });
});
