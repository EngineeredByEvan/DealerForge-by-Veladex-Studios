import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { createHmac } from 'crypto';
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
    dealerships: [{ id: 'd-1', twilioFromPhone: '+15550009999', twilioMessagingServiceSid: 'MG123' }],
    leads: [
      { id: 'lead-1', dealershipId: 'd-1', phone: '+15550001111', email: 'lead@example.com', status: 'NEW', lastActivityAt: null as Date | null, firstName: 'Lead', lastName: 'One', vehicleInterest: null, sourceId: null, soldAt: null, leadScore: 0, leadScoreUpdatedAt: new Date(), assignedToUserId: null }
    ],
    threads: [] as Array<{ id: string; dealershipId: string; leadId: string; createdAt: Date }>,
    messages: [] as Array<any>,
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
    dealership: {
      findUnique: jest.fn(async ({ where }: any) => state.dealerships.find((d) => d.id === where.id) ?? null),
      findFirst: jest.fn(async ({ where }: any) =>
        state.dealerships.find((d) => d.twilioFromPhone === where?.OR?.[1]?.twilioFromPhone || d.twilioMessagingServiceSid === where?.OR?.[0]?.twilioMessagingServiceSid) ?? null
      )
    },
    lead: {
      findFirst: jest.fn(async ({ where, select, include }: any) => {
        const lead = state.leads.find((candidate) =>
          (where.id ? candidate.id === where.id : true) &&
          (where.dealershipId ? candidate.dealershipId === where.dealershipId : true) &&
          (where.phone ? candidate.phone === where.phone : true)
        );
        if (!lead) return null;
        if (include?.source || include?.assignedToUser) {
          return { ...lead, source: null, assignedToUser: null };
        }
        if (select?.appointments) {
          return { ...lead, appointments: [] };
        }
        return lead;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const lead = state.leads.find((candidate) => candidate.id === where.id);
        if (!lead) throw new Error('Lead not found');
        Object.assign(lead, data);
        return lead;
      }),
      create: jest.fn(async ({ data }: any) => {
        const lead = { id: `lead-${state.leads.length + 1}`, ...data, email: null, lastActivityAt: null };
        state.leads.push(lead);
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
      count: jest.fn(async ({ where }: any) => state.messages.filter((message) => (where.channel?.in ? where.channel.in.includes(message.channel) : where.channel ? message.channel === where.channel : true) && (where.direction ? message.direction === where.direction : true)).length),
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
      update: jest.fn(async ({ where, data }: any) => {
        const message = state.messages.find((m) => m.id === where.id);
        Object.assign(message, data, { updatedAt: new Date() });
        return message;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        for (const message of state.messages) {
          if (message.providerMessageId === where.providerMessageId) Object.assign(message, data);
        }
        return { count: 1 };
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
    communicationTemplate: { findMany: jest.fn(async () => []) }
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.COMMUNICATIONS_MODE = 'mock';
    process.env.TWILIO_WEBHOOK_AUTH_TOKEN = 'test-hook-token';

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


  function twilioSignature(path: string, payload: Record<string, string>): string {
    const url = `http://127.0.0.1${path}`;
    const sortedEntries = Object.entries(payload).sort(([a], [b]) => a.localeCompare(b));
    const data = `${url}${sortedEntries.map(([key, value]) => `${key}${value}`).join('')}`;
    return createHmac('sha1', process.env.TWILIO_WEBHOOK_AUTH_TOKEN!).update(data).digest('base64');
  }

  async function loginAsAdmin(): Promise<string> {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    return loginRes.body.accessToken;
  }

  it('sending SMS in mock mode creates message and event', async () => {
    const token = await loginAsAdmin();

    const response = await request(app.getHttpServer())
      .post('/api/v1/communications/leads/lead-1/messages/sms')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ body: 'Hello from test' })
      .expect(201);

    expect(response.body.message.channel).toBe('SMS');
    expect(response.body.message.status).toBe('SENT');
    expect(response.body.lead.leadScore).toBeGreaterThan(0);
    expect(state.eventLogs.some((event) => event.eventType === 'sms_sent')).toBe(true);
  });

  it('wrong dealership cannot send SMS for lead not in tenant', async () => {
    const token = await loginAsAdmin();

    await request(app.getHttpServer())
      .post('/api/v1/communications/leads/lead-1/messages/sms')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-2')
      .send({ body: 'Blocked' })
      .expect(403);
  });

  it('inbound Twilio webhook routes by To phone and creates inbound message', async () => {
    const payload = {
      From: '+15550002222',
      To: '+15550009999',
      Body: 'Inbound hello',
      MessageSid: 'SM-INBOUND-1'
    };
    const response = await request(app.getHttpServer())
      .post('/api/v1/webhooks/twilio/sms/inbound')
      .set('host', '127.0.0.1')
      .set('x-twilio-signature', twilioSignature('/api/v1/webhooks/twilio/sms/inbound', payload))
      .send(payload)
      .expect(201);

    expect(response.body.ok).toBe(true);
    const inbound = state.messages.find((msg) => msg.providerMessageId === 'SM-INBOUND-1');
    expect(inbound?.direction).toBe('INBOUND');
    expect(inbound?.status).toBe('RECEIVED');
  });
});
