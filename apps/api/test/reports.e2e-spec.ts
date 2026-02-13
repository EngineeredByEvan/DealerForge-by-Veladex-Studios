import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

type EventLogState = {
  id: string;
  dealershipId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown> | null;
  occurredAt: Date;
};

describe('Reports endpoints (e2e)', () => {
  let app: INestApplication;

  const state = {
    users: [
      {
        id: 'u-admin',
        email: 'admin@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Admin',
        lastName: 'User'
      }
    ],
    memberships: [{ userId: 'u-admin', dealershipId: 'd-1', role: 'ADMIN' }],
    eventLogs: [
      {
        id: 'evt-lead-1',
        dealershipId: 'd-1',
        eventType: 'lead_created',
        entityType: 'Lead',
        entityId: 'lead-1',
        payload: { source: 'Web', assignedToUserId: 'u-sales-1', status: 'NEW' },
        occurredAt: new Date('2026-03-01T10:00:00.000Z')
      },
      {
        id: 'evt-lead-2',
        dealershipId: 'd-1',
        eventType: 'lead_created',
        entityType: 'Lead',
        entityId: 'lead-2',
        payload: { source: 'Web', assignedToUserId: 'u-sales-2', status: 'NEW' },
        occurredAt: new Date('2026-03-02T10:00:00.000Z')
      },
      {
        id: 'evt-lead-3',
        dealershipId: 'd-1',
        eventType: 'lead_created',
        entityType: 'Lead',
        entityId: 'lead-3',
        payload: { source: 'Phone', assignedToUserId: 'u-sales-1', status: 'NEW' },
        occurredAt: new Date('2026-03-03T10:00:00.000Z')
      },
      {
        id: 'evt-appt-1',
        dealershipId: 'd-1',
        eventType: 'appointment_created',
        entityType: 'Appointment',
        entityId: 'appt-1',
        payload: { leadId: 'lead-1', status: 'SET' },
        occurredAt: new Date('2026-03-03T12:00:00.000Z')
      },
      {
        id: 'evt-appt-2',
        dealershipId: 'd-1',
        eventType: 'appointment_created',
        entityType: 'Appointment',
        entityId: 'appt-2',
        payload: { leadId: 'lead-2', status: 'SET' },
        occurredAt: new Date('2026-03-03T13:00:00.000Z')
      },
      {
        id: 'evt-show-1',
        dealershipId: 'd-1',
        eventType: 'appointment_status_changed',
        entityType: 'Appointment',
        entityId: 'appt-1',
        payload: { status: 'SHOWED' },
        occurredAt: new Date('2026-03-04T12:00:00.000Z')
      },
      {
        id: 'evt-sold-1',
        dealershipId: 'd-1',
        eventType: 'lead_status_changed',
        entityType: 'Lead',
        entityId: 'lead-2',
        payload: { status: 'SOLD' },
        occurredAt: new Date('2026-03-05T12:00:00.000Z')
      },
      {
        id: 'evt-d2-lead',
        dealershipId: 'd-2',
        eventType: 'lead_created',
        entityType: 'Lead',
        entityId: 'lead-d2',
        payload: { source: 'Web', assignedToUserId: 'u-sales-9', status: 'NEW' },
        occurredAt: new Date('2026-03-01T10:00:00.000Z')
      }
    ] as EventLogState[]
  };

  const prismaMock: any = {
    user: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const user = state.users.find((candidate) => candidate.id === where?.id || candidate.email === where?.email);
        if (!user) return null;

        if (include?.dealerships) {
          return {
            ...user,
            dealerships: state.memberships
              .filter((membership) => membership.userId === user.id)
              .map((membership) => ({
                ...membership,
                dealership: { id: membership.dealershipId, name: `Dealership ${membership.dealershipId}` }
              }))
          };
        }

        return user;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = state.users.find((candidate) => candidate.id === where.id);
        if (!user) return null;
        user.refreshTokenHash = data.refreshTokenHash ?? null;
        return user;
      })
    },
    userDealershipRole: {
      findFirst: jest.fn(async ({ where }: any) => {
        return state.memberships.find((membership) => membership.userId === where.userId && membership.dealershipId === where.dealershipId) ?? null;
      })
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => ({ id: `audit-${Date.now()}`, createdAt: new Date(), ...data }))
    },
    eventLog: {
      create: jest.fn(async ({ data }: any) => ({ id: `event-${Date.now()}`, ...data })),
      findMany: jest.fn(async ({ where, orderBy, select }: any) => {
        let events = state.eventLogs.filter((event) => {
          if (where?.dealershipId && event.dealershipId !== where.dealershipId) return false;
          if (where?.eventType && event.eventType !== where.eventType) return false;
          if (where?.entityType && event.entityType !== where.entityType) return false;
          if (where?.occurredAt?.gte && event.occurredAt < where.occurredAt.gte) return false;
          if (where?.occurredAt?.lte && event.occurredAt > where.occurredAt.lte) return false;
          return true;
        });

        if (orderBy?.occurredAt === 'desc') {
          events = [...events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
        }

        const mapped = events.map((event) => {
          if (!select) return event;
          const result: Record<string, unknown> = {};
          for (const key of Object.keys(select)) {
            result[key] = (event as unknown as Record<string, unknown>)[key];
          }
          return result;
        });

        return mapped;
      })
    },
    lead: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), create: jest.fn() },
    appointment: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), create: jest.fn() },
    activity: { findFirst: jest.fn() },
    task: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), create: jest.fn() },
    integration: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    integrationEvent: { create: jest.fn(), findMany: jest.fn() },
    leadSource: { findFirst: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(async (arg: any): Promise<any> => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg))),
    $queryRaw: jest.fn(),
    aiRequestLog: { create: jest.fn() }
  };

  const loginAsAdmin = async (): Promise<string> => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    return loginRes.body.accessToken;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns summary metrics from event logs with expected counts', async () => {
    const token = await loginAsAdmin();

    const response = await request(app.getHttpServer())
      .get('/api/v1/reports/summary')
      .query({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(response.body).toEqual({
      total_leads: 3,
      appointments_set: 2,
      appointments_showed: 1,
      show_rate: 0.5,
      appointment_rate: 0.6667,
      sold_count: 1,
      close_rate: 0.3333
    });
  });

  it('returns dealership-scoped breakdown and trends', async () => {
    const token = await loginAsAdmin();

    const breakdown = await request(app.getHttpServer())
      .get('/api/v1/reports/breakdown')
      .query({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-31T23:59:59.999Z', dimension: 'source' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(breakdown.body[0]).toEqual(
      expect.objectContaining({
        key: 'Web',
        total_leads: 2,
        appointments_set: 2,
        sold_count: 1
      })
    );

    const trends = await request(app.getHttpServer())
      .get('/api/v1/reports/trends')
      .query({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-31T23:59:59.999Z', metric: 'leads', interval: 'day' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(trends.body).toEqual(
      expect.arrayContaining([
        { period: '2026-03-01T00:00:00.000Z', value: 1 },
        { period: '2026-03-02T00:00:00.000Z', value: 1 },
        { period: '2026-03-03T00:00:00.000Z', value: 1 }
      ])
    );
  });

  it('denies reports access when user is not a member of dealership', async () => {
    const token = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/api/v1/reports/summary')
      .query({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-2')
      .expect(403);
  });
});
