import { ActivityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateActivityDto {
  @IsEnum(ActivityType)
  type!: ActivityType;

  @Transform(({ value }) => normalizeOptionalString(value) ?? value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(255)
  outcome?: string;
}
