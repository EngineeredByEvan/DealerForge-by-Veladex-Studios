import { Prisma } from '@prisma/client';

type PrismaJsonPrimitive = string | number | boolean | null;
type PrismaJson = PrismaJsonPrimitive | Prisma.InputJsonObject | Prisma.InputJsonArray;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toInputJsonInternal(value: unknown): PrismaJson {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toInputJsonInternal(item));
  }

  if (isPlainObject(value)) {
    const output: Record<string, PrismaJson> = {};

    for (const [key, item] of Object.entries(value)) {
      output[key] = toInputJsonInternal(item);
    }

    return output as Prisma.InputJsonObject;
  }

  return String(value);
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const normalized = toInputJsonInternal(value);

  if (normalized === null) {
    return Prisma.JsonNull;
  }

  return normalized;
}
