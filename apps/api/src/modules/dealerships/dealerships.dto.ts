import { DealershipStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDealershipDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @IsOptional()
  @IsEnum(DealershipStatus)
  status?: DealershipStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  dealerGroupName?: string;

  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown>;
}

export class UpdateDealershipDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsEnum(DealershipStatus)
  status?: DealershipStatus;

  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown>;
}

export class UpdateDealershipSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsEnum(DealershipStatus)
  status?: DealershipStatus;

  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown>;
}

export class ListDealershipsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  q?: string;
}
