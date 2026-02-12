import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type AuditActor = {
  userId?: string | null;
};

export type AuditEventInput = {
  dealershipId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  actor?: AuditActor;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService | null, private readonly mode: 'PRISMA' | 'NOOP') {}

  async logEvent(input: AuditEventInput) {
    if (!this.prisma) {
      // TODO: Restore Prisma-backed logging only once PrismaService DI wiring is fully stable in every runtime path.
      return null;
    }

    return this.prisma.auditLog.create({
      data: {
        dealershipId: input.dealershipId,
        userId: input.actor?.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata
      }
    });
  }

  async listRecent(dealershipId: string, limit = 50) {
    if (!this.prisma) {
      return [];
    }

    return this.prisma.auditLog.findMany({
      where: { dealershipId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200)
    });
  }

  getMode(): 'PRISMA' | 'NOOP' {
    return this.mode;
  }
}
