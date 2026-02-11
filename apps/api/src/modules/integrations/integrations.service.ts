import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { IntegrationProvider, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { GenericAdapter } from './adapters/generic.adapter';
import { IntegrationAdapter, LeadInboundDto } from './adapters/integration-adapter.interface';
import { CreateIntegrationDto } from './integrations.dto';

const INTEGRATION_INCLUDE = {
  _count: {
    select: {
      events: true
    }
  }
} satisfies Prisma.IntegrationInclude;

@Injectable()
export class IntegrationsService {
  private readonly genericAdapter = new GenericAdapter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService
  ) {}

  async createIntegration(dealershipId: string, payload: CreateIntegrationDto) {
    const webhookSecret = payload.webhookSecret ?? randomUUID();

    return this.prisma.integration.create({
      data: {
        dealershipId,
        name: payload.name,
        provider: payload.provider,
        webhookSecret,
        config: payload.config,
        isActive: payload.isActive ?? true
      },
      include: INTEGRATION_INCLUDE
    });
  }

  async listIntegrations(dealershipId: string) {
    return this.prisma.integration.findMany({
      where: { dealershipId },
      include: INTEGRATION_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
  }

  async importCsv(
    dealershipId: string,
    csv: string,
    integrationId?: string,
    fallbackSource?: string
  ) {
    const rows = this.parseCsv(csv);
    const integration = integrationId
      ? await this.prisma.integration.findFirst({
          where: {
            id: integrationId,
            dealershipId,
            isActive: true
          }
        })
      : null;

    if (integrationId && !integration) {
      throw new BadRequestException('integrationId was not found for the active dealership');
    }

    let successCount = 0;
    let failureCount = 0;

    for (const row of rows) {
      const provider = integration?.provider ?? IntegrationProvider.GENERIC;
      const event = await this.prisma.integrationEvent.create({
        data: {
          dealershipId,
          integrationId: integration?.id,
          provider,
          rawPayload: row,
          parsedOk: false
        }
      });

      try {
        const adapter = this.resolveAdapter(provider);
        const leadPayload = adapter.parseInbound({ ...row, source: row.source ?? fallbackSource });
        const lead = await this.createLeadFromInbound(dealershipId, leadPayload, integration?.name);

        await this.prisma.integrationEvent.update({
          where: { id: event.id },
          data: {
            parsedOk: true,
            parsedPayload: leadPayload,
            leadId: lead.id,
            error: null
          }
        });
        successCount += 1;
      } catch (error) {
        await this.prisma.integrationEvent.update({
          where: { id: event.id },
          data: {
            parsedOk: false,
            error: error instanceof Error ? error.message : 'Unknown parse error'
          }
        });
        failureCount += 1;
      }
    }

    return {
      totalRows: rows.length,
      successCount,
      failureCount
    };
  }

  async handleWebhook(providerRaw: string, providedSecret: string | undefined, payload: unknown) {
    const provider = this.toIntegrationProvider(providerRaw);
    if (!providedSecret) {
      throw new UnauthorizedException('Missing integration webhook secret');
    }

    const integration = await this.prisma.integration.findFirst({
      where: {
        provider,
        webhookSecret: providedSecret,
        isActive: true
      }
    });

    if (!integration) {
      throw new UnauthorizedException('Invalid integration webhook secret');
    }

    const event = await this.prisma.integrationEvent.create({
      data: {
        dealershipId: integration.dealershipId,
        integrationId: integration.id,
        provider,
        rawPayload: payload as Prisma.InputJsonValue,
        parsedOk: false
      }
    });

    try {
      const adapter = this.resolveAdapter(provider);
      const leadPayload = adapter.parseInbound(payload);
      const lead = await this.createLeadFromInbound(
        integration.dealershipId,
        leadPayload,
        integration.name
      );

      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: {
          parsedOk: true,
          parsedPayload: leadPayload,
          leadId: lead.id,
          error: null
        }
      });

      return {
        ok: true,
        integrationEventId: event.id,
        leadId: lead.id
      };
    } catch (error) {
      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: {
          parsedOk: false,
          error: error instanceof Error ? error.message : 'Unknown parse error'
        }
      });

      return {
        ok: false,
        integrationEventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown parse error'
      };
    }
  }

  private resolveAdapter(_provider: IntegrationProvider): IntegrationAdapter {
    return this.genericAdapter;
  }

  private async createLeadFromInbound(
    dealershipId: string,
    payload: LeadInboundDto,
    integrationName?: string
  ) {
    return this.leadsService.createLead(dealershipId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      vehicleInterest: payload.vehicleInterest,
      source: payload.source ?? integrationName
    });
  }

  private toIntegrationProvider(providerRaw: string): IntegrationProvider {
    const normalized = providerRaw.trim().toUpperCase();
    if (!(normalized in IntegrationProvider)) {
      throw new BadRequestException(`Unsupported integration provider: ${providerRaw}`);
    }

    return normalized as IntegrationProvider;
  }

  private parseCsv(csv: string): Array<Record<string, string>> {
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must include header and at least one data row');
    }

    const headers = lines[0].split(',').map((header) => header.trim());
    if (headers.some((header) => header.length === 0)) {
      throw new BadRequestException('CSV header contains empty columns');
    }

    return lines.slice(1).map((line, index) => {
      const columns = line.split(',').map((column) => column.trim());
      if (columns.length !== headers.length) {
        throw new BadRequestException(`CSV row ${index + 2} has unexpected column count`);
      }

      const row: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        row[header] = columns[headerIndex] ?? '';
      });

      return row;
    });
  }
}
