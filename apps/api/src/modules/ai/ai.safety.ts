import { Prisma } from '@prisma/client';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d[\d\s().-]{7,}\d)/g;

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
  if (payload === null || payload === undefined) {
    return Prisma.JsonNull;
  }

  if (typeof payload === 'string') {
    return redactText(payload);
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactJson(item));
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const output: Record<string, Prisma.InputJsonValue | Prisma.JsonNull> = {};

    for (const [key, value] of Object.entries(record)) {
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

      output[key] = redactJson(value);
    }

    return output;
  }

  return String(payload);
}
