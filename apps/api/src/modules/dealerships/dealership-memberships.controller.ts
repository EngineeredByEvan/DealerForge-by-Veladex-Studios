import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { AuthUser } from '../../common/types/request-context';
import { DealershipsService } from './dealerships.service';

type RequestWithUser = Request & { user?: AuthUser };

@Controller('dealerships')
@SkipTenant()
export class DealershipMembershipsController {
  constructor(private readonly dealershipsService: DealershipsService) {}

  @Get('mine')
  listMine(@Req() req: RequestWithUser) {
    return this.dealershipsService.listMine(req.user!.userId);
  }
}
