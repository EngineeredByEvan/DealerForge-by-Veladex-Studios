import { BadRequestException } from '@nestjs/common';
import { IntegrationAdapter, LeadInboundDto } from './integration-adapter.interface';

type GenericPayload = Record<string, unknown>;

export class GenericAdapter implements IntegrationAdapter {
  parseInbound(payload: unknown): LeadInboundDto {
    const normalizedPayload = this.toRecord(payload);

    const source = this.toString(normalizedPayload, ['source', 'leadSource', 'provider']);
    const firstName = this.toString(normalizedPayload, ['firstName', 'first_name', 'fname']);
    const lastName = this.toString(normalizedPayload, ['lastName', 'last_name', 'lname']);
    const email = this.toString(normalizedPayload, ['email', 'emailAddress', 'email_address']);
    const phone = this.toString(normalizedPayload, ['phone', 'phoneNumber', 'phone_number', 'mobile']);
    const vehicleInterest = this.toString(normalizedPayload, [
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

  private toRecord(payload: unknown): GenericPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Inbound payload must be an object');
    }

    return payload as GenericPayload;
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
