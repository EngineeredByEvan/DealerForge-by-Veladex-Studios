import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SmsProvider, SmsSendInput, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  constructor(private readonly prisma: PrismaService) {}

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const mode = process.env.COMMUNICATIONS_MODE ?? 'mock';
    if (mode !== 'twilio') {
      return { providerMessageId: `mock-sms-${Date.now()}`, status: 'SENT' };
    }

    const dealership = await this.prisma.dealership.findUnique({
      where: { id: input.dealershipId },
      select: {
        twilioAccountSid: true,
        twilioAuthToken: true,
        twilioMessagingServiceSid: true,
        twilioFromPhone: true
      }
    });

    const accountSid = dealership?.twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID;
    const authToken = dealership?.twilioAuthToken ?? process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return {
        providerMessageId: `twilio-missing-creds-${Date.now()}`,
        status: 'FAILED',
        errorCode: 'TWILIO_CONFIG_MISSING',
        errorMessage: 'COMMUNICATIONS_MODE=twilio but Twilio credentials are missing'
      };
    }

    const messagingServiceSid = dealership?.twilioMessagingServiceSid;
    const fromPhone = dealership?.twilioFromPhone;
    if (!messagingServiceSid && !fromPhone) {
      return {
        providerMessageId: `twilio-missing-from-${Date.now()}`,
        status: 'FAILED',
        errorCode: 'TWILIO_SENDER_MISSING',
        errorMessage: 'Dealership Twilio configuration missing messaging service SID and from phone'
      };
    }

    try {
      const form = new URLSearchParams();
      form.set('To', input.to);
      form.set('Body', input.body);
      if (messagingServiceSid) {
        form.set('MessagingServiceSid', messagingServiceSid);
      } else {
        form.set('From', fromPhone!);
      }

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      });

      const payload = await response.json() as { sid?: string; from?: string; code?: number; message?: string };
      if (!response.ok || !payload.sid) {
        return {
          providerMessageId: `twilio-failed-${Date.now()}`,
          status: 'FAILED',
          errorCode: payload.code ? String(payload.code) : 'TWILIO_SEND_FAILED',
          errorMessage: payload.message ?? 'Twilio message send failed'
        };
      }

      return {
        providerMessageId: payload.sid,
        status: 'SENT',
        fromPhone: payload.from ?? fromPhone ?? undefined
      };
    } catch (error) {
      const err = error as { message?: string };
      return {
        providerMessageId: `twilio-failed-${Date.now()}`,
        status: 'FAILED',
        errorCode: 'TWILIO_SEND_FAILED',
        errorMessage: err.message ?? 'Twilio message send failed'
      };
    }
  }
}
