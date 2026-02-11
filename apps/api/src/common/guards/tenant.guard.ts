import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator';
import { AuthUser, TenantContext } from '../types/request-context';

type RequestWithContext = Request & { user?: AuthUser; tenant?: TenantContext };

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (shouldSkip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required');
    }

    const dealershipId = request.header('x-dealership-id');
    if (!dealershipId) {
      throw new BadRequestException('x-dealership-id header is required');
    }

    const membership = await this.prisma.userDealershipRole.findFirst({
      where: {
        userId: user.userId,
        dealershipId
      }
    });

    if (!membership) {
      throw new ForbiddenException('User does not have access to this dealership');
    }

    request.tenant = {
      dealershipId,
      role: membership.role
    };

    return true;
  }
}
