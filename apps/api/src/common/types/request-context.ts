import { Role } from '@prisma/client';

export type AuthUser = {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  isPlatformOperator: boolean;
  platformRole: 'NONE' | 'OPERATOR' | 'ADMIN';
};

export type TenantContext = {
  dealershipId: string;
  role: Role;
};
