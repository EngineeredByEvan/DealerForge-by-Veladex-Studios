export type EmailSendInput = {
  to: string;
  subject?: string;
  body: string;
};

export type EmailSendResult = {
  providerMessageId: string;
  status: 'SENT';
};

export interface EmailProvider {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

export const EMAIL_PROVIDER_TOKEN = Symbol('EMAIL_PROVIDER_TOKEN');
