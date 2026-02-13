import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, TenantContext } from '../types/request-context';

@Injectable()
export class PlatformOrDealershipAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser; tenant?: TenantContext }>();
    const user = request.user;
    const tenant = request.tenant;

    if (!user || !tenant) {
      throw new ForbiddenException('Access context is incomplete');
    }

    if (user.platformRole === 'ADMIN' || user.platformRole === 'OPERATOR') {
      return true;
    }

    if (tenant.role === Role.ADMIN) {
      return true;
    }

    throw new ForbiddenException('Integrations access requires platform operator/admin or dealership admin role');
  }
}
