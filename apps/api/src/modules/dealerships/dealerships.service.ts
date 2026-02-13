import { ForbiddenException, Injectable } from '@nestjs/common';
import { DealershipStatus, Prisma, Role } from '@prisma/client';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateDealershipDto,
  ListDealershipsDto,
  UpdateDealershipDto,
  UpdateDealershipSettingsDto
} from './dealerships.dto';

const DEALERSHIP_INCLUDE = {
  dealerGroup: { select: { id: true, name: true } }
} satisfies Prisma.DealershipInclude;

@Injectable()
export class DealershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateDealershipDto) {
    const dealerGroup = await this.prisma.dealerGroup.upsert({
      where: {
        name: payload.dealerGroupName ?? 'Default Dealer Group'
      },
      update: {},
      create: {
        name: payload.dealerGroupName ?? 'Default Dealer Group'
      }
    });

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.DealershipCreateInput = {
        name: payload.name,
        slug: payload.slug,
        timezone: payload.timezone,
        status: payload.status ?? DealershipStatus.ACTIVE,
        ...(payload.businessHours !== undefined
          ? { businessHours: payload.businessHours as Prisma.InputJsonValue }
          : {}),
        ...(payload.twilioMessagingServiceSid !== undefined
          ? { twilioMessagingServiceSid: payload.twilioMessagingServiceSid }
          : {}),
        ...(payload.twilioFromPhone !== undefined ? { twilioFromPhone: payload.twilioFromPhone } : {}),
        ...(payload.twilioAccountSid !== undefined ? { twilioAccountSid: payload.twilioAccountSid } : {}),
        ...(payload.twilioAuthToken !== undefined ? { twilioAuthToken: payload.twilioAuthToken } : {}),
        dealerGroup: { connect: { id: dealerGroup.id } }
      };

      const dealership = await tx.dealership.create({
        data,
        include: DEALERSHIP_INCLUDE
      });

      await tx.leadSource.createMany({
        data: [
          { dealershipId: dealership.id, name: 'Website' },
          { dealershipId: dealership.id, name: 'Phone' },
          { dealershipId: dealership.id, name: 'Walk-in' }
        ],
        skipDuplicates: true
      });

      return dealership;
    });
  }

  async list(query: ListDealershipsDto) {
    return this.prisma.dealership.findMany({
      where: query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } }
            ]
          }
        : undefined,
      include: DEALERSHIP_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
  }


  async listMine(userId: string) {
    const memberships = await this.prisma.userDealershipRole.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        dealership: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        }
      },
      orderBy: {
        dealership: {
          name: 'asc'
        }
      }
    });

    return memberships.map((membership) => ({
      dealershipId: membership.dealershipId,
      name: membership.dealership.name,
      slug: membership.dealership.slug,
      status: membership.dealership.status,
      role: membership.role,
      isActive: membership.isActive
    }));
  }

  async update(dealershipId: string, payload: UpdateDealershipDto) {
    const data: Prisma.DealershipUpdateInput = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
      ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.businessHours !== undefined
        ? { businessHours: payload.businessHours as Prisma.InputJsonValue }
        : {}),
      ...(payload.twilioMessagingServiceSid !== undefined
        ? { twilioMessagingServiceSid: payload.twilioMessagingServiceSid }
        : {}),
      ...(payload.twilioFromPhone !== undefined ? { twilioFromPhone: payload.twilioFromPhone } : {}),
      ...(payload.twilioAccountSid !== undefined ? { twilioAccountSid: payload.twilioAccountSid } : {}),
      ...(payload.twilioAuthToken !== undefined ? { twilioAuthToken: payload.twilioAuthToken } : {})
    };

    return this.prisma.dealership.update({
      where: { id: dealershipId },
      data,
      include: DEALERSHIP_INCLUDE
    });
  }

  async getSettings(dealershipId: string, user: AuthUser, tenant?: TenantContext) {
    this.assertSettingsAccess(dealershipId, user, tenant);

    const dealership = await this.prisma.dealership.findUniqueOrThrow({
      where: { id: dealershipId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        status: true,
        businessHours: true,
        twilioMessagingServiceSid: true,
        twilioFromPhone: true,
        twilioAccountSid: true,
        twilioAuthToken: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ...dealership,
      twilioAuthToken: undefined,
      twilioAuthTokenConfigured: Boolean(dealership.twilioAuthToken)
    };
  }

  async updateSettings(
    dealershipId: string,
    payload: UpdateDealershipSettingsDto,
    user: AuthUser,
    tenant?: TenantContext
  ) {
    this.assertSettingsAccess(dealershipId, user, tenant);

    const data: Prisma.DealershipUpdateInput = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.businessHours !== undefined
        ? { businessHours: payload.businessHours as Prisma.InputJsonValue }
        : {}),
      ...(payload.twilioMessagingServiceSid !== undefined
        ? { twilioMessagingServiceSid: payload.twilioMessagingServiceSid }
        : {}),
      ...(payload.twilioFromPhone !== undefined ? { twilioFromPhone: payload.twilioFromPhone } : {}),
      ...(payload.twilioAccountSid !== undefined ? { twilioAccountSid: payload.twilioAccountSid } : {}),
      ...(payload.twilioAuthToken !== undefined ? { twilioAuthToken: payload.twilioAuthToken } : {})
    };

    const dealership = await this.prisma.dealership.update({
      where: { id: dealershipId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        status: true,
        businessHours: true,
        twilioMessagingServiceSid: true,
        twilioFromPhone: true,
        twilioAccountSid: true,
        twilioAuthToken: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      ...dealership,
      twilioAuthToken: undefined,
      twilioAuthTokenConfigured: Boolean(dealership.twilioAuthToken)
    };
  }

  async deactivate(dealershipId: string) {
    return this.prisma.dealership.update({
      where: { id: dealershipId },
      data: { status: DealershipStatus.INACTIVE },
      include: DEALERSHIP_INCLUDE
    });
  }



  private assertSettingsAccess(dealershipId: string, user: AuthUser, tenant?: TenantContext): void {
    if (user.platformRole === 'ADMIN' || user.platformRole === 'OPERATOR') {
      return;
    }

    if (!tenant) {
      throw new ForbiddenException('Tenant context is required for dealership settings access');
    }

    if (tenant.dealershipId !== dealershipId || tenant.role !== Role.ADMIN) {
      throw new ForbiddenException('Only dealership admins can manage their own dealership settings');
    }
  }
}
