import { BadRequestException } from '@nestjs/common';
import { IntegrationAdapter, LeadInboundDto } from './integration-adapter.interface';

type GenericPayload = Record<string, unknown>;

function isGenericPayload(payload: unknown): payload is GenericPayload {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

export class GenericAdapter implements IntegrationAdapter {
  parseInbound(payload: unknown): LeadInboundDto {
    if (!isGenericPayload(payload)) {
      throw new BadRequestException('Inbound payload must be an object');
    }

    const source = this.toString(payload, ['source', 'leadSource', 'provider']);
    const firstName = this.toString(payload, ['firstName', 'first_name', 'fname']);
    const lastName = this.toString(payload, ['lastName', 'last_name', 'lname']);
    const email = this.toString(payload, ['email', 'emailAddress', 'email_address']);
    const phone = this.toString(payload, ['phone', 'phoneNumber', 'phone_number', 'mobile']);
    const vehicleInterest = this.toString(payload, [
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
