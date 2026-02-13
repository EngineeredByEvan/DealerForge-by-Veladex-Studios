import { Injectable } from '@nestjs/common';
import { DealershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDealershipDto, UpdateDealershipDto } from './dealerships.dto';

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

    return this.prisma.dealership.create({
      data: {
        autoGroupId,
        name: payload.name,
        slug: payload.slug,
        timezone: payload.timezone,
        status: payload.status ?? DealershipStatus.ACTIVE
      },
      include: DEALERSHIP_INCLUDE
    });
  }

  async list() {
    return this.prisma.dealership.findMany({
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

  async deactivate(dealershipId: string) {
    return this.prisma.dealership.update({
      where: { id: dealershipId },
      data: { status: DealershipStatus.INACTIVE },
      include: DEALERSHIP_INCLUDE
    });
  }
}
