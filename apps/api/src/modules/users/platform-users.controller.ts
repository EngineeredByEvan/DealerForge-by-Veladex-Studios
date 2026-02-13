import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import {
  CreateMembershipDto,
  UpdateMembershipDto
} from './users.dto';
import { UsersService } from './users.service';

@Controller('platform/users')
@SkipTenant()
@PlatformAdmin()
export class PlatformUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers() {
    return this.usersService.listUsersWithMemberships();
  }

  @Post(':userId/memberships')
  createMembership(@Param('userId') userId: string, @Body() payload: CreateMembershipDto) {
    return this.usersService.createMembership(userId, payload);
  }

  @Patch(':userId/memberships/:dealershipId')
  updateMembership(
    @Param('userId') userId: string,
    @Param('dealershipId') dealershipId: string,
    @Body() payload: UpdateMembershipDto
  ) {
    return this.usersService.updateMembership(userId, dealershipId, payload);
  }

  @Delete(':userId/memberships/:dealershipId')
  deleteMembership(@Param('userId') userId: string, @Param('dealershipId') dealershipId: string) {
    return this.usersService.deactivateMembership(userId, dealershipId);
  }
}
