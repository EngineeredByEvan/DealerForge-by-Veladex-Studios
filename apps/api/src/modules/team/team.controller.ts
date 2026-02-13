import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, TenantContext } from '../../common/types/request-context';
import { InviteUserDto, SetRoleDto } from './team.dto';
import { TeamService } from './team.service';

type TenantRequest = Request & { user?: AuthUser; tenant?: TenantContext };

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('users')
  listUsers(@Req() req: TenantRequest) {
    return this.teamService.listUsers(req.user!, req.tenant!);
  }

  @Post('invitations')
  invite(@Req() req: TenantRequest, @Body() payload: InviteUserDto) {
    return this.teamService.inviteUser(req.user!, req.tenant!, payload);
  }

  @Get('invitations')
  listInvitations(@Req() req: TenantRequest) {
    return this.teamService.listInvitations(req.user!, req.tenant!);
  }

  @Post('invitations/:invitationId/revoke')
  revokeInvitation(@Req() req: TenantRequest, @Param('invitationId') invitationId: string) {
    return this.teamService.revokeInvitation(req.user!, req.tenant!, invitationId);
  }

  @Patch('users/:userId/role')
  setRole(@Req() req: TenantRequest, @Param('userId') userId: string, @Body() payload: SetRoleDto) {
    return this.teamService.setRole(req.user!, req.tenant!, userId, payload.role);
  }

  @Post('users/:userId/deactivate')
  deactivate(@Req() req: TenantRequest, @Param('userId') userId: string) {
    return this.teamService.deactivateMembership(req.user!, req.tenant!, userId);
  }
}
