import { Injectable } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  async send(_input: SmsSendInput): Promise<SmsSendResult> {
    return {
      providerMessageId: `mock-sms-${Date.now()}`,
      status: 'SENT'
    };
  }
}
