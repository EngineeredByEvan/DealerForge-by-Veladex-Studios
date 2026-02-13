import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

const toOptionalTrimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString()
  @IsNotEmpty()
  lastName?: string;
}

export class AcceptInviteDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString()
  firstName?: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString()
  lastName?: string;
}

export class SetRoleDto {
  @IsEnum(Role)
  role!: Role;
}
