import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ADMIN_KEY = 'platformAdmin';
export const PlatformAdmin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PLATFORM_ADMIN_KEY, true);
