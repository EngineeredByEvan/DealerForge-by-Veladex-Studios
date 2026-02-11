import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserDealershipRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

type UserWithRoles = User & { dealerships: (UserDealershipRole & { dealership: { id: string; name: string } })[] };

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

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' }
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' }
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash }
    });

    return { accessToken, refreshToken };
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
      { sub: user.id, email: user.email },
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
    dealerships: { dealershipId: string; dealershipName: string; role: string }[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        dealerships: {
          include: {
            dealership: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      dealerships: user.dealerships.map((membership) => ({
        dealershipId: membership.dealershipId,
        dealershipName: membership.dealership.name,
        role: membership.role
      }))
    };
  }

  private findUserByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        dealerships: {
          include: {
            dealership: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
  }
}
