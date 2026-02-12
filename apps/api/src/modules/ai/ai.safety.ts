import { Prisma } from '@prisma/client';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d[\d\s().-]{7,}\d)/g;

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function redactJsonValue(payload: unknown): Prisma.InputJsonValue | null {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (typeof payload === 'string') {
    return redactText(payload);
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactJsonValue(item));
  }

  if (isRecord(payload)) {
    const output: Prisma.InputJsonObject = {};

    for (const [key, value] of Object.entries(payload)) {
      const lowered = key.toLowerCase();
      if (['firstname', 'lastname', 'name', 'email', 'phone'].includes(lowered)) {
        output[key] = '[REDACTED]';
        continue;
      }

      if (
        ['message', 'summary', 'instruction', 'subject', 'body', 'outcome', 'vehicleinterest'].includes(
          lowered
        )
      ) {
        output[key] = '[REDACTED_TEXT]';
        continue;
      }

      output[key] = redactJsonValue(value);
    }

    return output;
  }

  return String(payload);
}

export function redactText(input?: string | null): string {
  if (!input) {
    return '';
  }

  return input.replace(EMAIL_REGEX, '[REDACTED_EMAIL]').replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

export function redactName(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim() ? `${firstName.trim()[0]}.` : '';
  const last = lastName?.trim() ? `${lastName.trim()[0]}.` : '';
  const redacted = `${first} ${last}`.trim();

  return redacted.length > 0 ? redacted : 'Unknown';
}

export function redactJson(payload: unknown): Prisma.InputJsonValue | Prisma.JsonNull {
  const redacted = redactJsonValue(payload);

  if (redacted === null) {
    return Prisma.JsonNull;
  }

  return redacted;
}
