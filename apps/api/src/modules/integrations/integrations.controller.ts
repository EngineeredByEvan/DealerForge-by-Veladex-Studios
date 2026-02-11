import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { TenantContext } from '../../common/types/request-context';
import { CreateIntegrationDto, ImportCsvDto, WebhookParamsDto } from './integrations.dto';
import { IntegrationsService } from './integrations.service';

type TenantRequest = Request & { tenant?: TenantContext };

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Req() req: TenantRequest, @Body() payload: CreateIntegrationDto) {
    return this.integrationsService.createIntegration(req.tenant!.dealershipId, payload);
  }

  @Get()
  findAll(@Req() req: TenantRequest) {
    return this.integrationsService.listIntegrations(req.tenant!.dealershipId);
  }

  @Post('import/csv')
  importCsv(@Req() req: TenantRequest, @Body() payload: ImportCsvDto) {
    return this.integrationsService.importCsv(
      req.tenant!.dealershipId,
      payload.csv,
      payload.integrationId,
      payload.source
    );
  }

  @Post(':provider/webhook')
  @Public()
  @SkipTenant()
  webhook(
    @Param() params: WebhookParamsDto,
    @Headers('x-integration-secret') integrationSecret: string | undefined,
    @Body() payload: unknown
  ) {
    return this.integrationsService.handleWebhook(params.provider, integrationSecret, payload);
  }
}
