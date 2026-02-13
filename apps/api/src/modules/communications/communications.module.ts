import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { EventLogModule } from '../event-log/event-log.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import { MockEmailProvider } from './providers/mock-email.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { MockTelephonyProvider } from './providers/mock-telephony.provider';
import { SMS_PROVIDER_TOKEN } from './providers/sms-provider.interface';
import { TELEPHONY_PROVIDER_TOKEN } from './providers/telephony-provider.interface';

@Module({
  imports: [PrismaModule, AuditModule, EventLogModule],
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    MockSmsProvider,
    MockEmailProvider,
    MockTelephonyProvider,
    {
      provide: SMS_PROVIDER_TOKEN,
      useExisting: MockSmsProvider
    },
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useExisting: MockEmailProvider
    },
    {
      provide: TELEPHONY_PROVIDER_TOKEN,
      useExisting: MockTelephonyProvider
    }
  ],
  exports: [CommunicationsService]
})
export class CommunicationsModule {}
