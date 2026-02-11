import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  @Get('metrics')
  @Roles(Role.ADMIN)
  metrics(): { scope: string } {
    return { scope: 'admin-only' };
  }
}
