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
import { TwilioSmsProvider } from './providers/twilio-sms.provider';
import { TwilioWebhooksController } from './twilio-webhooks.controller';

@Module({
  imports: [PrismaModule, AuditModule, EventLogModule],
  controllers: [CommunicationsController, TwilioWebhooksController],
  providers: [
    CommunicationsService,
    MockSmsProvider,
    TwilioSmsProvider,
    MockEmailProvider,
    MockTelephonyProvider,
    {
      provide: SMS_PROVIDER_TOKEN,
      useExisting: TwilioSmsProvider
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
