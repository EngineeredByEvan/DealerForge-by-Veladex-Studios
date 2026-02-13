import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvitationStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { AcceptInviteDto, InviteUserDto } from './team.dto';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(actor: AuthUser, tenant: TenantContext) {
    void actor;

    return this.prisma.userDealershipRole.findMany({
      where: { dealershipId: tenant.dealershipId, isActive: true },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async inviteUser(actor: AuthUser, tenant: TenantContext, payload: InviteUserDto) {
    await this.assertAdmin(actor, tenant);

    const invitation = await this.prisma.invitation.create({
      data: {
        token: randomUUID(),
        email: payload.email.toLowerCase(),
        dealershipId: tenant.dealershipId,
        role: payload.role,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        createdBy: actor.userId
      }
    });

    return {
      id: invitation.id,
      token: invitation.token,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt
    };
  }

  async acceptInvite(payload: AcceptInviteDto) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token: payload.token } });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation is invalid');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED }
      });
      throw new BadRequestException('Invitation has expired');
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const email = invitation.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
      : await this.prisma.user.create({
          data: {
            email,
            passwordHash,
            firstName: payload.firstName ?? 'Invited',
            lastName: payload.lastName ?? 'User'
          }
        });

    await this.prisma.userDealershipRole.upsert({
      where: {
        userId_dealershipId: {
          userId: user.id,
          dealershipId: invitation.dealershipId
        }
      },
      update: {
        role: invitation.role,
        isActive: true
      },
      create: {
        userId: user.id,
        dealershipId: invitation.dealershipId,
        role: invitation.role,
        isActive: true
      }
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date()
      }
    });

    return { success: true };
  }

  async setRole(actor: AuthUser, tenant: TenantContext, userId: string, role: Role) {
    await this.assertAdmin(actor, tenant);

    return this.prisma.userDealershipRole.update({
      where: {
        userId_dealershipId: {
          userId,
          dealershipId: tenant.dealershipId
        }
      },
      data: { role }
    });
  }

  async deactivateMembership(actor: AuthUser, tenant: TenantContext, userId: string) {
    await this.assertAdmin(actor, tenant);

    return this.prisma.userDealershipRole.update({
      where: {
        userId_dealershipId: {
          userId,
          dealershipId: tenant.dealershipId
        }
      },
      data: { isActive: false }
    });
  }

  private async assertAdmin(actor: AuthUser, tenant: TenantContext): Promise<void> {
    if (actor.isPlatformAdmin || tenant.role === Role.ADMIN) {
      return;
    }

    throw new ForbiddenException('Admin access is required');
  }
}
