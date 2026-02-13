import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { IntegrationProvider, Prisma } from '@prisma/client';
import { toPrismaJson } from '../../common/prisma/prisma-json';
import { randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeadsService } from '../leads/leads.service';
import { EventLogService } from '../event-log/event-log.service';
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
  private readonly webhookRateLimitWindowMs = 60_000;
  private readonly webhookRateLimitMax = 60;
  private readonly webhookHits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly auditService: AuditService,
    private readonly eventLogService: EventLogService
  ) {}

  async createIntegration(dealershipId: string, payload: CreateIntegrationDto) {
    const webhookSecret = payload.webhookSecret ?? randomUUID();

    return this.prisma.integration.create({
      data: {
        dealershipId,
        name: payload.name,
        provider: payload.provider,
        webhookSecret,
        config: payload.config === undefined ? undefined : toPrismaJson(payload.config),
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
          rawPayload: toPrismaJson(row),
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
            parsedPayload: toPrismaJson(leadPayload),
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

    await this.eventLogService.emit({
      dealershipId,
      eventType: 'integration_csv_import_completed',
      entityType: 'Integration',
      entityId: integration?.id ?? 'csv_import',
      payload: {
        integrationId: integration?.id ?? null,
        totalRows: rows.length,
        successCount,
        failureCount
      }
    });

    return {
      totalRows: rows.length,
      successCount,
      failureCount
    };
  }

  async handleWebhook(
    providerRaw: string,
    providedSecret: string | undefined,
    payload: unknown,
    requestIdentity: string
  ) {
    const provider = this.toIntegrationProvider(providerRaw);
    this.enforceWebhookRateLimit(provider, requestIdentity);

    if (!providedSecret) {
      throw new UnauthorizedException('Missing integration webhook secret');
    }

    const integrations = await this.prisma.integration.findMany({
      where: {
        provider,
        isActive: true
      }
    });

    const integration = integrations.find((candidate) =>
      this.constantTimeSecretMatch(candidate.webhookSecret, providedSecret)
    );

    if (!integration) {
      throw new UnauthorizedException('Invalid integration webhook secret');
    }

    const event = await this.prisma.integrationEvent.create({
      data: {
        dealershipId: integration.dealershipId,
        integrationId: integration.id,
        provider,
        rawPayload: toPrismaJson(payload),
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
          parsedPayload: toPrismaJson(leadPayload),
          leadId: lead.id,
          error: null
        }
      });

      await this.auditService.logEvent({
        dealershipId: integration.dealershipId,
        action: 'integration_event_ingested',
        entityType: 'IntegrationEvent',
        entityId: event.id,
        metadata: {
          provider,
          integrationId: integration.id,
          parsedOk: true,
          leadId: lead.id
        }
      });

      return {
        ok: true,
        integrationEventId: event.id,
        leadId: lead.id
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';

      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: {
          parsedOk: false,
          error: message
        }
      });

      await this.auditService.logEvent({
        dealershipId: integration.dealershipId,
        action: 'integration_event_ingested',
        entityType: 'IntegrationEvent',
        entityId: event.id,
        metadata: {
          provider,
          integrationId: integration.id,
          parsedOk: false,
          error: message
        }
      });

      return {
        ok: false,
        integrationEventId: event.id,
        error: message
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

  private constantTimeSecretMatch(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private enforceWebhookRateLimit(provider: IntegrationProvider, requestIdentity: string): void {
    const now = Date.now();
    const key = `${provider}:${requestIdentity}`;
    const recentHits = (this.webhookHits.get(key) ?? []).filter(
      (timestamp) => now - timestamp < this.webhookRateLimitWindowMs
    );

    if (recentHits.length >= this.webhookRateLimitMax) {
      this.webhookHits.set(key, recentHits);
      throw new HttpException('Webhook rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    recentHits.push(now);
    this.webhookHits.set(key, recentHits);
  }
}
