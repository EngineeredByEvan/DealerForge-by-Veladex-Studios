import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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


export class SetRoleDto {
  @IsEnum(Role)
  role!: Role;
}
