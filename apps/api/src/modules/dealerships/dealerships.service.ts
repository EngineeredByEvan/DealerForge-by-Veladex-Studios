import { ForbiddenException, Injectable } from '@nestjs/common';
import { DealershipStatus, Prisma, Role } from '@prisma/client';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDealershipDto, ListDealershipsDto, UpdateDealershipDto, UpdateDealershipSettingsDto } from './dealerships.dto';

const DEALERSHIP_INCLUDE = {
  autoGroup: { select: { id: true, name: true } }
} satisfies Prisma.DealershipInclude;

@Injectable()
export class DealershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateDealershipDto) {
    const autoGroup = await this.prisma.autoGroup.findFirst({ orderBy: { createdAt: 'asc' } });
    const autoGroupId = autoGroup
      ? autoGroup.id
      : (
          await this.prisma.autoGroup.create({
            data: { name: 'Default Auto Group' }
          })
        ).id;

    return this.prisma.$transaction(async (tx) => {
      const dealership = await tx.dealership.create({
        data: {
          autoGroupId,
          name: payload.name,
          slug: payload.slug,
          timezone: payload.timezone,
          status: payload.status ?? DealershipStatus.ACTIVE,
          businessHours: payload.businessHours
        },
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

  async update(dealershipId: string, payload: UpdateDealershipDto) {
    return this.prisma.dealership.update({
      where: { id: dealershipId },
      data: payload,
      include: DEALERSHIP_INCLUDE
    });
  }

  async getSettings(dealershipId: string, user: AuthUser, tenant?: TenantContext) {
    this.assertSettingsAccess(dealershipId, user, tenant);

    return this.prisma.dealership.findUniqueOrThrow({
      where: { id: dealershipId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        status: true,
        businessHours: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async updateSettings(
    dealershipId: string,
    payload: UpdateDealershipSettingsDto,
    user: AuthUser,
    tenant?: TenantContext
  ) {
    this.assertSettingsAccess(dealershipId, user, tenant);

    return this.prisma.dealership.update({
      where: { id: dealershipId },
      data: payload,
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        status: true,
        businessHours: true,
        createdAt: true,
        updatedAt: true
      }
    });
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
