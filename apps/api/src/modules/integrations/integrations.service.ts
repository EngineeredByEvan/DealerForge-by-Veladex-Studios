import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
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
import { CsvImportFailure, CsvImportSuccess, LeadStatusValue, LeadTypeValue, normalizeCsvRow, parseCsvRows } from './csv-import';

const INTEGRATION_INCLUDE = {
  _count: {
    select: {
      events: true
    }
  }
} satisfies Prisma.IntegrationInclude;

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly genericAdapter = new GenericAdapter();
  private readonly webhookRateLimitWindowMs = 60_000;
  private readonly webhookRateLimitMax = 60;
  private readonly csvImportMaxRows = 2_000;
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
    // Root cause for 0/50 imports: previous parser split on commas and required exact key names.
    // Quoted values/BOM/header variants (e.g. firstname, lead_source) were not normalized, which made
    // email/phone appear missing for every row and adapter validation rejected all rows.
    const parsedCsv = parseCsvRows(csv);

    if (parsedCsv.rows.length > this.csvImportMaxRows) {
      throw new BadRequestException(`CSV import supports up to ${this.csvImportMaxRows} rows per request`);
    }

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
    const successes: CsvImportSuccess[] = [];
    const failures: CsvImportFailure[] = [];

    for (let rowIndex = 0; rowIndex < parsedCsv.rows.length; rowIndex += 1) {
      const rowNumber = rowIndex + 2;
      const row = parsedCsv.rows[rowIndex];
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

      const { normalized, errors } = normalizeCsvRow(row);
      if (errors.length > 0) {
        await this.prisma.integrationEvent.update({
          where: { id: event.id },
          data: {
            parsedOk: false,
            error: errors.map((entry) => `${entry.field}: ${entry.message}`).join('; ')
          }
        });

        failureCount += 1;
        failures.push({
          row: rowNumber,
          raw: row,
          errors
        });
        continue;
      }

      try {
        const adapter = this.resolveAdapter(provider);
        const leadPayload = adapter.parseInbound({
          ...row,
          ...normalized,
          source: normalized.source ?? fallbackSource
        });

        const duplicateReason = await this.findDuplicateLeadReason(
          dealershipId,
          leadPayload.email,
          leadPayload.phone
        );

        if (duplicateReason) {
          const duplicateError = `skipped duplicate (${duplicateReason})`;
          await this.prisma.integrationEvent.update({
            where: { id: event.id },
            data: {
              parsedOk: false,
              error: duplicateError
            }
          });
          failureCount += 1;
          failures.push({
            row: rowNumber,
            raw: row,
            errors: [{ field: duplicateReason, message: duplicateError }]
          });
          continue;
        }

        const lead = await this.createLeadFromInbound(dealershipId, {
          ...leadPayload,
          leadType: normalized.leadType,
          status: normalized.status
        }, integration?.name);

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
        successes.push({
          row: rowNumber,
          leadId: lead.id,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown parse error';
        await this.prisma.integrationEvent.update({
          where: { id: event.id },
          data: {
            parsedOk: false,
            error: message
          }
        });

        failureCount += 1;
        failures.push({
          row: rowNumber,
          raw: row,
          errors: [{ field: 'row', message }]
        });
      }
    }

    this.logger.log(
      `CSV import completed dealershipId=${dealershipId} totalRows=${parsedCsv.rows.length} successCount=${successCount} failureCount=${failureCount}`
    );

    if (failures.length > 0) {
      const topFailures = failures.slice(0, 3).map((entry) => ({
        row: entry.row,
        reasons: entry.errors.map((error) => `${error.field}:${error.message}`)
      }));

      this.logger.warn(
        `CSV import had validation failures dealershipId=${dealershipId} samples=${JSON.stringify(topFailures)}`
      );
    }

    await this.eventLogService.emit({
      dealershipId,
      eventType: 'integration_csv_import_completed',
      entityType: 'Integration',
      entityId: integration?.id ?? 'csv_import',
      payload: {
        integrationId: integration?.id ?? null,
        totalRows: parsedCsv.rows.length,
        successCount,
        failureCount
      }
    });

    return {
      totalRows: parsedCsv.rows.length,
      successCount,
      failureCount,
      successes,
      failures
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
    payload: LeadInboundDto & { leadType?: LeadTypeValue; status?: LeadStatusValue },
    integrationName?: string
  ) {
    return this.leadsService.createLead(dealershipId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      vehicleInterest: payload.vehicleInterest,
      source: payload.source ?? integrationName,
      leadType: payload.leadType,
      status: payload.status
    });
  }

  private async findDuplicateLeadReason(
    dealershipId: string,
    email?: string,
    phone?: string
  ): Promise<'email' | 'phone' | null> {
    if (email) {
      const existingByEmail = await this.prisma.lead.findFirst({
        where: {
          dealershipId,
          email: {
            equals: email,
            mode: 'insensitive'
          }
        },
        select: { id: true }
      });
      if (existingByEmail) {
        return 'email';
      }
    }

    if (phone) {
      const existingByPhone = await this.prisma.lead.findFirst({
        where: {
          dealershipId,
          phone
        },
        select: { id: true }
      });
      if (existingByPhone) {
        return 'phone';
      }
    }

    return null;
  }

  private toIntegrationProvider(providerRaw: string): IntegrationProvider {
    const normalized = providerRaw.trim().toUpperCase();
    if (!(normalized in IntegrationProvider)) {
      throw new BadRequestException(`Unsupported integration provider: ${providerRaw}`);
    }

    return normalized as IntegrationProvider;
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
