import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InvitationStatus, User, UserDealershipRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

type UserWithRoles = User & { dealerships: (UserDealershipRole & { dealership: { id: string; name: string; slug: string } })[] };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.findUserByEmail(email);

    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }


  async getInvitation(token: string): Promise<{
    email: string;
    role: string;
    dealershipName: string;
    expiresAt: string;
    status: InvitationStatus;
  }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { dealership: { select: { name: true } } }
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const status = invitation.expiresAt.getTime() <= Date.now() && invitation.status === InvitationStatus.PENDING
      ? InvitationStatus.EXPIRED
      : invitation.status;

    return {
      email: invitation.email,
      role: invitation.role,
      dealershipName: invitation.dealership.name,
      expiresAt: invitation.expiresAt.toISOString(),
      status
    };
  }

  async acceptInvitation(payload: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const invitation = await this.prisma.invitation.findUnique({ where: { token: payload.token } });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation is invalid');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.EXPIRED } });
      throw new BadRequestException('Invitation has expired');
    }

    const email = invitation.email.toLowerCase();
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            firstName: payload.firstName,
            lastName: payload.lastName
          }
        })
      : await this.prisma.user.create({
          data: {
            email,
            passwordHash,
            firstName: payload.firstName,
            lastName: payload.lastName
          }
        });

    await this.prisma.userDealershipRole.upsert({
      where: {
        userId_dealershipId: { userId: user.id, dealershipId: invitation.dealershipId }
      },
      update: { role: invitation.role, isActive: true },
      create: {
        userId: user.id,
        dealershipId: invitation.dealershipId,
        role: invitation.role,
        isActive: true
      }
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() }
    });

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });

    const valid = user?.refreshTokenHash ? await bcrypt.compare(refreshToken, user.refreshTokenHash) : false;
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, isPlatformAdmin: user.isPlatformAdmin, isPlatformOperator: user.isPlatformOperator },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' }
    );

    const newRefreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' }
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(newRefreshToken, 10) }
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null }
    });
  }

  async me(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    isPlatformAdmin: boolean;
    isPlatformOperator: boolean;
    platformRole: 'NONE' | 'OPERATOR' | 'ADMIN';
    dealerships: { dealershipId: string; dealershipName: string; dealershipSlug: string; role: string }[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        dealerships: {
          include: {
            dealership: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const platformRole = user.isPlatformAdmin ? 'ADMIN' : user.isPlatformOperator ? 'OPERATOR' : 'NONE';

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isPlatformAdmin: user.isPlatformAdmin,
      isPlatformOperator: user.isPlatformOperator,
      platformRole,
      dealerships: user.dealerships
        .filter((membership) => membership.isActive)
        .sort((a, b) => a.dealership.name.localeCompare(b.dealership.name))
        .map((membership) => ({
        dealershipId: membership.dealershipId,
        dealershipName: membership.dealership.name,
        dealershipSlug: membership.dealership.slug,
        role: membership.role
      }))
    };
  }


  private async issueTokens(user: Pick<User, 'id' | 'email' | 'isPlatformAdmin' | 'isPlatformOperator'>): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, isPlatformAdmin: user.isPlatformAdmin, isPlatformOperator: user.isPlatformOperator },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' }
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' }
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(refreshToken, 10) }
    });

    return { accessToken, refreshToken };
  }

  private findUserByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        dealerships: {
          include: {
            dealership: {
              select: { id: true, name: true, slug: true }
            }
          }
        }
      }
    });
  }
}
