import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateCurrentUserDto } from './users.dto';

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
}
