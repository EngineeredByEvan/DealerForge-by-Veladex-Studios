export type SmsSendInput = {
  to: string;
  body: string;
  dealershipId: string;
};

export type SmsSendResult = {
  providerMessageId: string;
  status: 'SENT' | 'FAILED';
  fromPhone?: string;
  errorCode?: string;
  errorMessage?: string;
};

export interface SmsProvider {
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

export const SMS_PROVIDER_TOKEN = Symbol('SMS_PROVIDER_TOKEN');
