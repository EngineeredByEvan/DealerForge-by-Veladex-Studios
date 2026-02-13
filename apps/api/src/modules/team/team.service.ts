import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvitationStatus, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { InviteUserDto } from './team.dto';

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


  async listInvitations(actor: AuthUser, tenant: TenantContext) {
    await this.assertAdmin(actor, tenant);

    const invitations = await this.prisma.invitation.findMany({
      where: { dealershipId: tenant.dealershipId },
      include: { dealership: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      token: invitation.token,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      status:
        invitation.status === InvitationStatus.PENDING && invitation.expiresAt.getTime() <= Date.now()
          ? InvitationStatus.EXPIRED
          : invitation.status,
      acceptedAt: invitation.acceptedAt,
      dealershipName: invitation.dealership.name
    }));
  }

  async revokeInvitation(actor: AuthUser, tenant: TenantContext, invitationId: string) {
    await this.assertAdmin(actor, tenant);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, dealershipId: tenant.dealershipId }
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    return this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED }
    });
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
