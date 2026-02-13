import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Communications endpoints (e2e)', () => {
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
    leads: [
      {
        id: 'lead-1',
        dealershipId: 'd-1',
        phone: '+15550001111',
        email: 'lead@example.com',
        lastActivityAt: null as Date | null
      }
    ],
    threads: [] as Array<{ id: string; dealershipId: string; leadId: string; createdAt: Date }>,
    messages: [] as Array<Record<string, unknown>>,
    eventLogs: [] as Array<Record<string, unknown>>
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const user = state.users.find((candidate) => candidate.id === where?.id || candidate.email === where?.email);
        if (!user) return null;

        if (include?.dealerships) {
          return {
            ...user,
            dealerships: state.memberships.map((membership) => ({
              ...membership,
              dealership: { id: membership.dealershipId, name: 'Store' }
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
      findFirst: jest.fn(async ({ where }: any) =>
        state.memberships.find((membership) => membership.userId === where.userId && membership.dealershipId === where.dealershipId) ?? null
      )
    },
    lead: {
      findFirst: jest.fn(async ({ where }: any) =>
        state.leads.find((lead) => lead.id === where.id && lead.dealershipId === where.dealershipId) ?? null
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const lead = state.leads.find((candidate) => candidate.id === where.id);
        if (!lead) throw new Error('Lead not found');
        lead.lastActivityAt = data.lastActivityAt ?? lead.lastActivityAt;
        return lead;
      })
    },
    conversationThread: {
      upsert: jest.fn(async ({ where, create }: any) => {
        const key = where.dealershipId_leadId;
        const existing = state.threads.find((thread) => thread.dealershipId === key.dealershipId && thread.leadId === key.leadId);
        if (existing) return existing;
        const created = { id: `thread-${state.threads.length + 1}`, dealershipId: create.dealershipId, leadId: create.leadId, createdAt: new Date() };
        state.threads.push(created);
        return created;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        state.threads.find((thread) => thread.dealershipId === where.dealershipId_leadId.dealershipId && thread.leadId === where.dealershipId_leadId.leadId) ?? null
      ),
      findFirst: jest.fn(async ({ where }: any) =>
        state.threads.find((thread) => thread.id === where.id && thread.dealershipId === where.dealershipId) ?? null
      )
    },
    message: {
      create: jest.fn(async ({ data }: any) => {
        const message = {
          id: `msg-${state.messages.length + 1}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          actorUser: { id: 'u-admin', firstName: 'Admin', lastName: 'User', email: 'admin@test.com' },
          thread: { id: data.threadId, leadId: 'lead-1' }
        };
        state.messages.push(message);
        return message;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        state.messages.filter((message) =>
          (where.dealershipId ? message.dealershipId === where.dealershipId : true) &&
          (where.threadId ? message.threadId === where.threadId : true)
        )
      )
    },
    eventLog: {
      create: jest.fn(async ({ data }: any) => {
        state.eventLogs.push(data);
        return { id: `evt-${state.eventLogs.length}`, ...data };
      })
    },
    communicationTemplate: {
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAsAdmin(): Promise<string> {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    return loginRes.body.accessToken;
  }

  it('sending a message creates a message and emits an event', async () => {
    const token = await loginAsAdmin();

    const response = await request(app.getHttpServer())
      .post('/api/v1/communications/leads/lead-1/send')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ channel: 'SMS', direction: 'OUTBOUND', body: 'Hello from test' })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.channel).toBe('SMS');
    expect(state.messages).toHaveLength(1);
    expect(state.eventLogs).toHaveLength(1);
    expect(state.eventLogs[0]?.eventType).toBe('message_sent');
  });
});
