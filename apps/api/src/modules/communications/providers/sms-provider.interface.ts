export type SmsSendInput = {
  to: string;
  body: string;
};

export type SmsSendResult = {
  providerMessageId: string;
  status: 'SENT';
};

export interface SmsProvider {
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

export const SMS_PROVIDER_TOKEN = Symbol('SMS_PROVIDER_TOKEN');
