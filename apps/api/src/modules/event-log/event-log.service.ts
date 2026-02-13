import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type EmitEventInput = {
  dealershipId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  payload?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

@Injectable()
export class EventLogService {
  private readonly logger = new Logger(EventLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async emit(input: EmitEventInput): Promise<void> {
    try {
      await this.prisma.eventLog.create({
        data: {
          dealershipId: input.dealershipId,
          actorUserId: input.actorUserId ?? null,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          payload: input.payload,
          occurredAt: input.occurredAt
        }
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist event log for dealership ${input.dealershipId}, eventType ${input.eventType}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
  }
}
