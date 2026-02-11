import { Role } from '@prisma/client';

export type AuthUser = {
  userId: string;
  email: string;
};

export type TenantContext = {
  dealershipId: string;
  role: Role;
};
