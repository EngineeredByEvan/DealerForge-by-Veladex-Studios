import { BadRequestException, Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { CommunicationsService } from './communications.service';
import { createHmac, timingSafeEqual } from 'crypto';

@Controller('webhooks/twilio/sms')
@Public()
@SkipTenant()
export class TwilioWebhooksController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post('inbound')
  async inbound(@Req() req: Request, @Body() payload: Record<string, string>, @Headers('x-twilio-signature') signature: string) {
    this.validateSignature(req, signature, payload);

    const toPhone = payload.To;
    const messagingServiceSid = payload.MessagingServiceSid;
    const dealership = await this.communicationsService.findDealershipByTwilioRouting({
      toPhone,
      messagingServiceSid
    });

    if (!dealership) throw new BadRequestException('Unable to route inbound SMS to dealership');

    await this.communicationsService.recordInboundSms({
      dealershipId: dealership.id,
      fromPhone: payload.From,
      toPhone,
      providerMessageId: payload.MessageSid,
      body: payload.Body ?? ''
    });

    return { ok: true };
  }

  @Post('status')
  async status(@Req() req: Request, @Body() payload: Record<string, string>, @Headers('x-twilio-signature') signature: string) {
    this.validateSignature(req, signature, payload);

    await this.communicationsService.updateMessageStatusByProviderMessageId(
      payload.MessageSid,
      payload.MessageStatus,
      payload.ErrorCode,
      payload.ErrorMessage
    );

    return { ok: true };
  }

  private validateSignature(req: Request, signature: string | undefined, payload: Record<string, string>) {
    const token = process.env.TWILIO_WEBHOOK_AUTH_TOKEN;
    if (!token || !signature) throw new BadRequestException('Invalid Twilio webhook signature');

    const host = req.get('host');
    const url = `${req.protocol}://${host}${req.originalUrl}`;
    const sortedEntries = Object.entries(payload).sort(([a], [b]) => a.localeCompare(b));
    const data = `${url}${sortedEntries.map(([key, value]) => `${key}${value}`).join('')}`;
    const expected = createHmac('sha1', token).update(data).digest('base64');

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);
    const valid = expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);

    if (!valid) {
      throw new BadRequestException('Invalid Twilio webhook signature');
    }
  }
}
