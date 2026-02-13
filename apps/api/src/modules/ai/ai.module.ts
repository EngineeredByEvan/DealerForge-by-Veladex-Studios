import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER_TOKEN } from './providers/ai-provider.interface';
import { MockAiProvider } from './providers/mock-ai.provider';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AiController],
  providers: [
    AiService,
    MockAiProvider,
    {
      provide: AI_PROVIDER_TOKEN,
      useExisting: MockAiProvider
    }
  ]
})
export class AiModule {}
