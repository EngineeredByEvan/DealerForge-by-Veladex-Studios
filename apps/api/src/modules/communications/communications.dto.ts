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

import { MessageDirection } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
  @IsEnum(MessageDirection)
  direction?: MessageDirection;
}

export class LogCallDto {
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  body?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;

  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection;

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
  @IsEnum(MessageDirection)
  direction?: MessageDirection;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  templateId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  toPhone?: string;
}


export class ListTemplatesQueryDto {
  @IsOptional()
  @IsEnum(CommunicationChannel)
  channel?: CommunicationChannel;
}

export class BulkSendDto {
  @IsArray()
  @IsString({ each: true })
  leadIds!: string[];

  @IsString()
  @IsNotEmpty()
  templateId!: string;
}
