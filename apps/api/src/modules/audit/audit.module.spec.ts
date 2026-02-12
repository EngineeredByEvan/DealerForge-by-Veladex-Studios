import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from './audit.module';
import { AuditService } from './audit.service';

describe('AuditModule', () => {
  it('compiles and resolves AuditService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, AuditModule]
    }).compile();

    expect(moduleRef.get(AuditService)).toBeDefined();
  });
});
