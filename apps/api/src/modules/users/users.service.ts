import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMembershipDto, UpdateCurrentUserDto, UpdateMembershipDto } from './users.dto';

const MEMBERSHIP_INCLUDE = {
  dealership: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true
    }
  }
} satisfies Prisma.UserDealershipRoleInclude;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateCurrentUser(userId: string, payload: UpdateCurrentUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: payload.firstName ?? user.firstName,
        lastName: payload.lastName ?? user.lastName,
        phone: payload.phone === undefined ? user.phone : payload.phone
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true
      }
    });
  }

  async listUsersWithMemberships() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isPlatformAdmin: true,
        isPlatformOperator: true,
        dealerships: {
          include: MEMBERSHIP_INCLUDE,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createMembership(userId: string, payload: CreateMembershipDto) {
    await this.assertUserAndDealershipExist(userId, payload.dealershipId);

    return this.prisma.userDealershipRole.upsert({
      where: {
        userId_dealershipId: {
          userId,
          dealershipId: payload.dealershipId
        }
      },
      create: {
        userId,
        dealershipId: payload.dealershipId,
        role: payload.role,
        isActive: payload.isActive ?? true
      },
      update: {
        role: payload.role,
        isActive: payload.isActive ?? true
      },
      include: MEMBERSHIP_INCLUDE
    });
  }

  async updateMembership(userId: string, dealershipId: string, payload: UpdateMembershipDto) {
    await this.assertUserAndDealershipExist(userId, dealershipId);

    return this.prisma.userDealershipRole.update({
      where: {
        userId_dealershipId: {
          userId,
          dealershipId
        }
      },
      data: {
        ...(payload.role !== undefined ? { role: payload.role } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {})
      },
      include: MEMBERSHIP_INCLUDE
    });
  }

  async deactivateMembership(userId: string, dealershipId: string) {
    await this.assertUserAndDealershipExist(userId, dealershipId);

    return this.prisma.userDealershipRole.update({
      where: {
        userId_dealershipId: {
          userId,
          dealershipId
        }
      },
      data: { isActive: false },
      include: MEMBERSHIP_INCLUDE
    });
  }

  private async assertUserAndDealershipExist(userId: string, dealershipId: string): Promise<void> {
    const [user, dealership] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.dealership.findUnique({ where: { id: dealershipId }, select: { id: true } })
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!dealership) {
      throw new NotFoundException('Dealership not found');
    }
  }
}
