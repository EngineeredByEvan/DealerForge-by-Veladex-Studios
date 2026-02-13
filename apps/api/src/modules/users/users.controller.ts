import { Body, Controller, Patch, Req } from '@nestjs/common';
import { Request } from 'express';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { AuthUser } from '../../common/types/request-context';
import { UpdateCurrentUserDto } from './users.dto';
import { UsersService } from './users.service';

type RequestWithUser = Request & { user?: AuthUser };

@Controller('users')
@SkipTenant()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  updateMe(@Req() req: RequestWithUser, @Body() payload: UpdateCurrentUserDto) {
    return this.usersService.updateCurrentUser(req.user!.userId, payload);
  }
}
