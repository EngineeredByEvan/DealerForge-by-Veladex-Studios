import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { AuthUser } from '../../common/types/request-context';
import { AuthService } from './auth.service';
import { AcceptInvitationDto, LoginDto, RefreshDto } from './auth.dto';

type RequestWithUser = Request & { user?: AuthUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @SkipTenant()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @SkipTenant()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto.refreshToken);
  }


  @Public()
  @SkipTenant()
  @Get('invitations/:token')
  invitation(@Param('token') token: string) {
    return this.authService.getInvitation(token);
  }

  @Public()
  @SkipTenant()
  @Post('accept-invitation')
  acceptInvitation(@Body() payload: AcceptInvitationDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.acceptInvitation(payload);
  }

  @SkipTenant()
  @Post('logout')
  async logout(@Req() req: RequestWithUser): Promise<{ success: true }> {
    await this.authService.logout(req.user!.userId);
    return { success: true };
  }

  @SkipTenant()
  @Get('me')
  me(@Req() req: RequestWithUser) {
    return this.authService.me(req.user!.userId);
  }
}
