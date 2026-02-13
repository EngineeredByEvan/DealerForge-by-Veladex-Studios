import { LeadStatus, LeadType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
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
  @IsEnum(LeadType)
  leadType?: LeadType;

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
  @IsEnum(LeadType)
  leadType?: LeadType;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  leadScore?: number;

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
  @IsEnum(LeadType)
  leadType?: LeadType;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  leadScore?: number;

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
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  assignedToUserId?: string;
}

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  status!: LeadStatus;
}
