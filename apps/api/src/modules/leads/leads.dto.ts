import { LeadStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ListLeadsQueryDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  dateRange?: string;
}

export class CreateLeadDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(255)
  vehicleInterest?: string;

  @IsOptional()
  @IsDateString()
  lastActivityAt?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(255)
  vehicleInterest?: string;

  @IsOptional()
  @IsDateString()
  lastActivityAt?: string;
}

export class AssignLeadDto {
  @IsString()
  @IsNotEmpty()
  assignedToUserId!: string;
}

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  status!: LeadStatus;
}
