export type LogCallInput = {
  to: string;
  durationSec: number;
  outcome: string;
  notes?: string;
};

export type LogCallResult = {
  providerMessageId: string;
  status: 'LOGGED';
};

export interface TelephonyProvider {
  logCall(input: LogCallInput): Promise<LogCallResult>;
}

export const TELEPHONY_PROVIDER_TOKEN = Symbol('TELEPHONY_PROVIDER_TOKEN');
