export enum CommunicationChannel {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  CALL = 'CALL',
  NOTE = 'NOTE'
}

export enum CommunicationDirection {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND'
}

import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export class CreateOrGetThreadDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  threadId?: string;
}

export class SendMessageDto {
  @IsEnum(CommunicationChannel)
  channel!: CommunicationChannel;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  subject?: string;

  @IsOptional()
  @IsEnum(CommunicationDirection)
  direction?: CommunicationDirection;
}

export class LogCallDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  body?: string;

  @IsInt()
  @Min(0)
  durationSec!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  outcome!: string;
}

export class CreateTemplateDto {
  @IsEnum(CommunicationChannel)
  channel!: CommunicationChannel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsEnum(CommunicationChannel)
  channel?: CommunicationChannel;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  body?: string;
}


export class SendLeadSmsDto {
  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  templateId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  toPhone?: string;
}
