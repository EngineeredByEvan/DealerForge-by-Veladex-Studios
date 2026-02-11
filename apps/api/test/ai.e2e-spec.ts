import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('AI endpoints (e2e)', () => {
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
    memberships: [{ userId: 'u-admin', dealershipId: 'd-1', role: Role.ADMIN }],
    logs: [] as unknown[]
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const user = state.users.find((candidate) => candidate.id === where?.id || candidate.email === where?.email);
        if (!user) {
          return null;
        }

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
        if (!user) {
          return null;
        }

        user.refreshTokenHash = data.refreshTokenHash ?? null;
        return user;
      })
    },
    userDealershipRole: {
      findFirst: jest.fn(async ({ where }: any) =>
        state.memberships.find(
          (membership) => membership.userId === where.userId && membership.dealershipId === where.dealershipId
        ) ?? null
      )
    },
    aIRequestLog: {
      create: jest.fn(async ({ data }: any) => {
        state.logs.push(data);
        return { id: `log-${state.logs.length}`, ...data };
      })
    },
    lead: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id !== 'lead-1' || where.dealershipId !== 'd-1') {
          return null;
        }

        return {
          id: 'lead-1',
          dealershipId: 'd-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phone: '+1 (555) 222-1234',
          status: 'QUALIFIED',
          vehicleInterest: '2025 Mazda CX-5',
          lastActivityAt: new Date('2025-01-01T00:00:00.000Z'),
          source: { name: 'Web' },
          _count: { activities: 3 },
          activities: [
            {
              type: 'EMAIL',
              subject: 'Payment options',
              createdAt: new Date('2025-01-02T00:00:00.000Z'),
              body: 'Looking for financing',
              outcome: null
            }
          ]
        };
      })
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(): Promise<string> {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    return loginRes.body.accessToken;
  }

  it('returns lead summary and redacted logs', async () => {
    const token = await login();

    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/lead/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ leadId: 'lead-1' })
      .expect(201);

    expect(response.body.summary).toContain('J. D.');
    expect(JSON.stringify(state.logs[state.logs.length - 1])).not.toContain('jane@example.com');
    expect(JSON.stringify(state.logs[state.logs.length - 1])).not.toContain('+1 (555) 222-1234');
  });

  it('returns lead score, draft followup and next best action', async () => {
    const token = await login();

    const scoreRes = await request(app.getHttpServer())
      .post('/api/v1/ai/lead/score')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ leadId: 'lead-1' })
      .expect(201);

    expect(scoreRes.body.score).toBeGreaterThan(0);

    const draftRes = await request(app.getHttpServer())
      .post('/api/v1/ai/lead/draft-followup')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ leadId: 'lead-1', channel: 'EMAIL', tone: 'PROFESSIONAL' })
      .expect(201);

    expect(draftRes.body.channel).toBe('EMAIL');
    expect(draftRes.body.message).toContain('Jane');

    const nbaRes = await request(app.getHttpServer())
      .post('/api/v1/ai/next-best-action')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ leadId: 'lead-1' })
      .expect(201);

    expect(nbaRes.body.action).toBeDefined();
  });
});
