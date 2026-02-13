import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { IntegrationProvider, LeadStatus, Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

type Membership = {
  userId: string;
  dealershipId: string;
  role: Role;
};

describe('Integrations (e2e)', () => {
  let app: INestApplication;

  const state = {
    users: [
      {
        id: 'u-admin',
        email: 'admin@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Admin',
        lastName: 'User',
        isPlatformAdmin: false,
        isPlatformOperator: false
      },
      {
        id: 'u-sales',
        email: 'sales@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Sales',
        lastName: 'User',
        isPlatformAdmin: false,
        isPlatformOperator: false
      },
      {
        id: 'u-operator',
        email: 'operator@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Opal',
        lastName: 'Operator',
        isPlatformAdmin: false,
        isPlatformOperator: true
      }
    ],
    memberships: [
      { userId: 'u-admin', dealershipId: 'd-1', role: Role.ADMIN },
      { userId: 'u-sales', dealershipId: 'd-1', role: Role.SALES },
      { userId: 'u-operator', dealershipId: 'd-1', role: Role.SALES }
    ] as Membership[],
    integrations: [] as Array<any>,
    events: [] as Array<any>,
    leads: [] as Array<any>,
    leadSources: [] as Array<any>
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const user = state.users.find(
          (candidate) => candidate.id === where?.id || candidate.email === where?.email
        );

        if (!user) {
          return null;
        }

        if (include?.dealerships) {
          return {
            ...user,
            dealerships: state.memberships
              .filter((membership) => membership.userId === user.id)
              .map((membership) => ({
                ...membership,
                dealership: {
                  id: membership.dealershipId,
                  name: 'Woodstock Mazda'
                }
              }))
          };
        }

        return user;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = state.users.find((candidate) => candidate.id === where.id);
        if (!user) {
          return null;
        }

        user.refreshTokenHash = data.refreshTokenHash ?? null;
        return user;
      })
    },
    userDealershipRole: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          state.memberships.find(
            (membership) =>
              membership.userId === where.userId && membership.dealershipId === where.dealershipId
          ) ?? null
        );
      })
    },
    integration: {
      create: jest.fn(async ({ data }: any) => {
        const integration = {
          id: `int-${state.integrations.length + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...data,
          _count: { events: 0 }
        };
        state.integrations.push(integration);
        return integration;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return state.integrations
          .filter((integration) => integration.dealershipId === where.dealershipId)
          .map((integration) => ({
            ...integration,
            _count: {
              events: state.events.filter((event) => event.integrationId === integration.id).length
            }
          }));
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          state.integrations.find((integration) => {
            if (where.id && integration.id !== where.id) return false;
            if (where.dealershipId && integration.dealershipId !== where.dealershipId) return false;
            if (where.provider && integration.provider !== where.provider) return false;
            if (where.webhookSecret && integration.webhookSecret !== where.webhookSecret) return false;
            if (where.isActive !== undefined && integration.isActive !== where.isActive) return false;
            return true;
          }) ?? null
        );
      })
    },
    integrationEvent: {
      create: jest.fn(async ({ data }: any) => {
        const event = {
          id: `evt-${state.events.length + 1}`,
          receivedAt: new Date().toISOString(),
          parsedPayload: null,
          error: null,
          leadId: null,
          ...data
        };
        state.events.push(event);
        return event;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const event = state.events.find((candidate) => candidate.id === where.id);
        Object.assign(event, data);
        return event;
      })
    },
    leadSource: {
      upsert: jest.fn(async ({ where, create }: any) => {
        const existing = state.leadSources.find(
          (source) =>
            source.dealershipId === where.dealershipId_name.dealershipId &&
            source.name === where.dealershipId_name.name
        );

        if (existing) {
          return existing;
        }

        const source = { id: `src-${state.leadSources.length + 1}`, ...create };
        state.leadSources.push(source);
        return source;
      })
    },
    lead: {
      create: jest.fn(async ({ data }: any) => {
        const lead = {
          id: `lead-${state.leads.length + 1}`,
          status: data.status ?? LeadStatus.NEW,
          ...data,
          source: data.sourceId
            ? state.leadSources.find((source) => source.id === data.sourceId) ?? null
            : null,
          assignedToUser: null
        };
        state.leads.push(lead);
        return lead;
      })
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => ({ id: `audit-${Date.now()}`, createdAt: new Date(), ...data }))
    },
    eventLog: {
      create: jest.fn(async ({ data }: any) => ({ id: `event-${Date.now()}`, ...data })),
      findMany: jest.fn(async ({ where }: any) => [])
    }
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(201);

    return response.body.accessToken as string;
  }

  it('allows ADMIN to create and list integrations', async () => {
    const accessToken = await loginAs('admin@test.com');

    await request(app.getHttpServer())
      .post('/api/v1/integrations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        name: 'Website Form',
        provider: IntegrationProvider.GENERIC,
        webhookSecret: 'secret-1'
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/integrations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Website Form');
  });

  it('blocks non-admin integration creation', async () => {
    const accessToken = await loginAs('sales@test.com');

    await request(app.getHttpServer())
      .post('/api/v1/integrations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        name: 'Sales Forbidden',
        provider: IntegrationProvider.GENERIC,
        webhookSecret: 'secret-2'
      })
      .expect(403);
  });

  it('allows platform operator to list and import integrations', async () => {
    const accessToken = await loginAs('operator@test.com');

    await request(app.getHttpServer())
      .get('/api/v1/integrations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/integrations/import/csv')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ csv: 'firstName,lastName,email\nOp,Erator,op@example.com', source: 'Operator CSV' })
      .expect(201);
  });

  it('imports CSV and creates integration events + leads', async () => {
    const accessToken = await loginAs('admin@test.com');

    const response = await request(app.getHttpServer())
      .post('/api/v1/integrations/import/csv')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        csv: [
          'firstName,lastName,email,phone,vehicleInterest',
          'Alex,Rivera,alex@example.com,5550001,2024 CX-5',
          'NoEmail,Lead,,,Used SUV'
        ].join('\n'),
        source: 'CSV Upload'
      })
      .expect(201);

    expect(response.body.totalRows).toBe(2);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);
    expect(state.events).toHaveLength(2);
    expect(state.events[0].parsedOk).toBe(true);
    expect(state.events[0].leadId).toBeTruthy();
    expect(state.events[1].parsedOk).toBe(false);
    expect(state.events[1].error).toContain('email or phone');
  });

  it('accepts public webhook, stores event and links lead', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/integrations/generic/webhook')
      .set('X-Integration-Secret', 'secret-1')
      .send({
        firstName: 'Webhook',
        lastName: 'Lead',
        email: 'webhook@example.com',
        vehicleInterest: '2025 CX-50'
      })
      .expect(201);

    expect(response.body.ok).toBe(true);
    const event = state.events.find((candidate) => candidate.id === response.body.integrationEventId);
    expect(event).toBeDefined();
    expect(event?.parsedOk).toBe(true);
    expect(event?.leadId).toBeTruthy();
  });
});
