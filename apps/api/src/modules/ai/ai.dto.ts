import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AiChannel, AiTone } from './ai.types';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class AiLeadRequestDto {
  @Transform(({ value }) => normalizeOptionalString(value) ?? value)
  @IsString()
  leadId!: string;
}

export class DraftFollowupRequestDto extends AiLeadRequestDto {
  @IsOptional()
  @IsIn(['SMS', 'EMAIL'])
  channel?: AiChannel;

  @IsOptional()
  @IsIn(['FRIENDLY', 'PROFESSIONAL', 'DIRECT'])
  tone?: AiTone;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(300)
  instruction?: string;
}
