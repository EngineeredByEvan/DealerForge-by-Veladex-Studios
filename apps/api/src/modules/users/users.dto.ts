import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const toOptionalTrimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export class UpdateCurrentUserDto {
  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class CreateMembershipDto {
  @IsNotEmpty()
  @IsString()
  dealershipId!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
