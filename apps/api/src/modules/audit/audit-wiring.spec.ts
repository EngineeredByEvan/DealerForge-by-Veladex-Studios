import 'reflect-metadata';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { TasksModule } from '../tasks/tasks.module';
import { AuditModule } from './audit.module';

const MODULE_IMPORTS_METADATA = 'imports';

describe('Audit and Prisma module wiring', () => {
  it('keeps PrismaModule imported by AuditModule', () => {
    const imports = Reflect.getMetadata(MODULE_IMPORTS_METADATA, AuditModule) as unknown[];

    expect(imports).toContain(PrismaModule);
  });

  it('keeps AuditModule imported by modules that inject AuditService', () => {
    const aiImports = Reflect.getMetadata(MODULE_IMPORTS_METADATA, AiModule) as unknown[];
    const taskImports = Reflect.getMetadata(MODULE_IMPORTS_METADATA, TasksModule) as unknown[];

    expect(aiImports).toContain(AuditModule);
    expect(taskImports).toContain(AuditModule);
  });
});
