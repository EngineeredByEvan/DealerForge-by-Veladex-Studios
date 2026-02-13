import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
