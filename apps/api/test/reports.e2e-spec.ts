import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AppointmentStatus, LeadStatus, Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

type Membership = {
  userId: string;
  dealershipId: string;
  role: Role;
};

type LeadState = {
  id: string;
  dealershipId: string;
  status: LeadStatus;
  createdAt: Date;
};

type AppointmentState = {
  id: string;
  dealershipId: string;
  status: AppointmentStatus;
  createdAt: Date;
};

type ActivityState = {
  id: string;
  leadId: string;
  createdAt: Date;
};

describe('Reports endpoints (e2e)', () => {
  let app: INestApplication;

  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60_000);

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
    memberships: [{ userId: 'u-admin', dealershipId: 'd-1', role: Role.ADMIN }] as Membership[],
    leads: [
      { id: 'lead-1', dealershipId: 'd-1', status: LeadStatus.NEW, createdAt: minutesAgo(120) },
      { id: 'lead-2', dealershipId: 'd-1', status: LeadStatus.SOLD, createdAt: daysAgo(2) },
      { id: 'lead-3', dealershipId: 'd-1', status: LeadStatus.NEW, createdAt: daysAgo(40) },
      { id: 'lead-4', dealershipId: 'd-2', status: LeadStatus.SOLD, createdAt: minutesAgo(30) }
    ] as LeadState[],
    appointments: [
      { id: 'appt-1', dealershipId: 'd-1', status: AppointmentStatus.SHOWED, createdAt: minutesAgo(100) },
      { id: 'appt-2', dealershipId: 'd-1', status: AppointmentStatus.SET, createdAt: daysAgo(3) },
      { id: 'appt-3', dealershipId: 'd-2', status: AppointmentStatus.SHOWED, createdAt: minutesAgo(20) }
    ] as AppointmentState[],
    activities: [
      { id: 'act-1', leadId: 'lead-1', createdAt: minutesAgo(60) },
      { id: 'act-2', leadId: 'lead-2', createdAt: daysAgo(1) },
      { id: 'act-3', leadId: 'lead-4', createdAt: minutesAgo(10) }
    ] as ActivityState[]
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
                  name: `Dealership ${membership.dealershipId}`
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
    lead: {
      count: jest.fn(async ({ where }: any) => {
        return state.leads.filter((lead) => {
          if (lead.dealershipId !== where.dealershipId) return false;
          if (where.status && lead.status !== where.status) return false;
          if (where.createdAt?.gte && lead.createdAt < where.createdAt.gte) return false;
          if (where.createdAt?.lte && lead.createdAt > where.createdAt.lte) return false;
          return true;
        }).length;
      }),
      findMany: jest.fn(async ({ where, select }: any) => {
        const filtered = state.leads.filter((lead) => lead.dealershipId === where.dealershipId);
        if (select) {
          return filtered.map((lead) => ({ id: lead.id, createdAt: lead.createdAt }));
        }
        return filtered;
      })
    },
    appointment: {
      count: jest.fn(async ({ where }: any) => {
        return state.appointments.filter((appointment) => {
          if (appointment.dealershipId !== where.dealershipId) return false;
          if (where.status && appointment.status !== where.status) return false;
          if (where.createdAt?.gte && appointment.createdAt < where.createdAt.gte) return false;
          if (where.createdAt?.lte && appointment.createdAt > where.createdAt.lte) return false;
          return true;
        }).length;
      })
    },
    activity: {
      findFirst: jest.fn(async ({ where }: any) => {
        const activities = state.activities
          .filter((activity) => activity.leadId === where.leadId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        if (!activities.length) {
          return null;
        }

        return { createdAt: activities[0].createdAt };
      })
    }
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

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true }
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns overview metrics scoped to selected dealership', async () => {
    const token = await loginAsAdmin();

    const response = await request(app.getHttpServer())
      .get('/api/v1/reports/overview')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(response.body.today).toEqual(
      expect.objectContaining({
        leads: 1,
        appointments: 1,
        shows: 1,
        sold: 0
      })
    );

    expect(response.body.month).toEqual(
      expect.objectContaining({
        leads: 2,
        appointments: 2,
        shows: 1,
        sold: 1
      })
    );
  });

  it('returns avg first response time scoped to selected dealership', async () => {
    const token = await loginAsAdmin();

    const response = await request(app.getHttpServer())
      .get('/api/v1/reports/response-time')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(response.body.sampleSize).toBe(2);
    expect(response.body.averageMinutes).toBeGreaterThan(0);
  });

  it('denies reports access when user is not a member of dealership', async () => {
    const token = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/api/v1/reports/overview')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-2')
      .expect(403);
  });
});
