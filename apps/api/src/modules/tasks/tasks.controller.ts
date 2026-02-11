import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { CreateTaskDto, ListTasksQueryDto, SnoozeTaskDto, UpdateTaskDto } from './tasks.dto';
import { TasksService } from './tasks.service';

type TenantRequest = Request & { tenant?: TenantContext; user?: AuthUser };

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Req() req: TenantRequest, @Query() query: ListTasksQueryDto) {
    return this.tasksService.listByDealership(req.tenant!.dealershipId, query);
  }

  @Post()
  create(@Req() req: TenantRequest, @Body() payload: CreateTaskDto) {
    return this.tasksService.createTask(req.tenant!.dealershipId, payload, req.user?.userId);
  }

  @Patch(':id')
  update(@Req() req: TenantRequest, @Param('id') taskId: string, @Body() payload: UpdateTaskDto) {
    return this.tasksService.updateTask(req.tenant!.dealershipId, taskId, payload, req.user?.userId);
  }

  @Post(':id/complete')
  complete(@Req() req: TenantRequest, @Param('id') taskId: string) {
    return this.tasksService.completeTask(req.tenant!.dealershipId, taskId, req.user?.userId);
  }

  @Post(':id/snooze')
  snooze(
    @Req() req: TenantRequest,
    @Param('id') taskId: string,
    @Body() payload: SnoozeTaskDto
  ) {
    return this.tasksService.snoozeTask(req.tenant!.dealershipId, taskId, payload, req.user?.userId);
  }
}
