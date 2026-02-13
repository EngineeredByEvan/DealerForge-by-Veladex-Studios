import { Role } from '@prisma/client';

export type AuthUser = {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
};

export type TenantContext = {
  dealershipId: string;
  role: Role;
};
