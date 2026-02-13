import { Injectable } from '@nestjs/common';
import { EmailProvider, EmailSendInput, EmailSendResult } from './email-provider.interface';

@Injectable()
export class MockEmailProvider implements EmailProvider {
  async send(_input: EmailSendInput): Promise<EmailSendResult> {
    return {
      providerMessageId: `mock-email-${Date.now()}`,
      status: 'SENT'
    };
  }
}
