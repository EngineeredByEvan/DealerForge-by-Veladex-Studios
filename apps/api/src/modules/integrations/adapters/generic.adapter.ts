import { BadRequestException } from '@nestjs/common';
import { IntegrationAdapter, LeadInboundDto } from './integration-adapter.interface';

type GenericPayload = Record<string, unknown>;

export class GenericAdapter implements IntegrationAdapter {
  parseInbound(payload: unknown): LeadInboundDto {
    const obj = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

    const source = this.toString(obj, ['source', 'leadSource', 'provider']);
    const firstName = this.toString(obj, ['firstName', 'first_name', 'fname']);
    const lastName = this.toString(obj, ['lastName', 'last_name', 'lname']);
    const email = this.toString(obj, ['email', 'emailAddress', 'email_address']);
    const phone = this.toString(obj, ['phone', 'phoneNumber', 'phone_number', 'mobile']);
    const vehicleInterest = this.toString(obj, [
      'vehicleInterest',
      'vehicle_interest',
      'vehicle',
      'stock',
      'vin'
    ]);

    if (!email && !phone) {
      throw new BadRequestException('Inbound payload must include either email or phone');
    }

    return {
      source,
      firstName,
      lastName,
      email,
      phone,
      vehicleInterest
    };
  }

  private toString(payload: GenericPayload, keys: string[]): string | undefined {
    for (const key of keys) {
      const raw = payload[key];
      if (typeof raw !== 'string') {
        continue;
      }

      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    return undefined;
  }
}
