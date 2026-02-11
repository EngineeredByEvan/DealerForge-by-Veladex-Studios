import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTaskDto, ListTasksQueryDto, SnoozeTaskDto, UpdateTaskDto } from './tasks.dto';

const TASK_INCLUDE = {
  assignedToUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  },
  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true
    }
  }
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listByDealership(dealershipId: string, query: ListTasksQueryDto) {
    const where: Prisma.TaskWhereInput = { dealershipId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.assignedTo) {
      where.assignedToUserId = query.assignedTo;
    }

    if (query.leadId) {
      where.leadId = query.leadId;
    }

    return this.prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async createTask(dealershipId: string, payload: CreateTaskDto) {
    await this.validateAssignee(dealershipId, payload.assignedToUserId);
    await this.validateLead(dealershipId, payload.leadId);

    return this.prisma.task.create({
      data: {
        dealershipId,
        title: payload.title.trim(),
        description: payload.description,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        assignedToUserId: payload.assignedToUserId,
        leadId: payload.leadId
      },
      include: TASK_INCLUDE
    });
  }

  async updateTask(dealershipId: string, taskId: string, payload: UpdateTaskDto) {
    await this.ensureTaskExists(dealershipId, taskId);

    if (payload.assignedToUserId !== undefined) {
      await this.validateAssignee(dealershipId, payload.assignedToUserId);
    }

    if (payload.leadId !== undefined) {
      await this.validateLead(dealershipId, payload.leadId);
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: payload.title?.trim(),
        description: payload.description,
        status: payload.status,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
        assignedToUserId: payload.assignedToUserId,
        leadId: payload.leadId
      },
      include: TASK_INCLUDE
    });
  }

  async completeTask(dealershipId: string, taskId: string) {
    const task = await this.findTaskById(dealershipId, taskId);

    if (task.status === TaskStatus.CANCELED) {
      throw new BadRequestException('Canceled tasks cannot be completed');
    }

    if (task.status === TaskStatus.DONE) {
      return task;
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.DONE
      },
      include: TASK_INCLUDE
    });
  }

  async snoozeTask(dealershipId: string, taskId: string, payload: SnoozeTaskDto) {
    const task = await this.findTaskById(dealershipId, taskId);

    if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELED) {
      throw new BadRequestException('Only active tasks can be snoozed');
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.SNOOZED,
        dueAt: new Date(payload.dueAt)
      },
      include: TASK_INCLUDE
    });
  }

  private async findTaskById(dealershipId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        dealershipId
      },
      include: TASK_INCLUDE
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private async ensureTaskExists(dealershipId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, dealershipId },
      select: { id: true }
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
  }

  private async validateAssignee(dealershipId: string, assignedToUserId?: string): Promise<void> {
    if (!assignedToUserId) {
      return;
    }

    const membership = await this.prisma.userDealershipRole.findFirst({
      where: {
        dealershipId,
        userId: assignedToUserId
      },
      select: { id: true }
    });

    if (!membership) {
      throw new BadRequestException('assignedToUserId must belong to the selected dealership');
    }
  }

  private async validateLead(dealershipId: string, leadId?: string): Promise<void> {
    if (!leadId) {
      return;
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        dealershipId
      },
      select: { id: true }
    });

    if (!lead) {
      throw new BadRequestException('leadId must belong to the selected dealership');
    }
  }
}
