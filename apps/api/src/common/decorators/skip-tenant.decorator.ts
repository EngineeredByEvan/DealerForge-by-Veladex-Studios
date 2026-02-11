import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenant';
export const SkipTenant = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_TENANT_KEY, true);
