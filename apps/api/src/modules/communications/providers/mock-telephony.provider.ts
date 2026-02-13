import { Injectable } from '@nestjs/common';
import { LogCallInput, LogCallResult, TelephonyProvider } from './telephony-provider.interface';

@Injectable()
export class MockTelephonyProvider implements TelephonyProvider {
  async logCall(_input: LogCallInput): Promise<LogCallResult> {
    return {
      providerMessageId: `mock-call-${Date.now()}`,
      status: 'LOGGED'
    };
  }
}
