import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { ActivityType, LeadStatus, Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

type Membership = {
  userId: string;
  dealershipId: string;
  role: Role;
};

type LeadSourceState = {
  id: string;
  dealershipId: string;
  name: string;
};



type ActivityState = {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  outcome: string | null;
  createdByUserId: string;
  leadId: string;
  createdAt: Date;
  updatedAt: Date;
};

type LeadState = {
  id: string;
  dealershipId: string;
  sourceId: string | null;
  status: LeadStatus;
  assignedToUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  vehicleInterest: string | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('Leads endpoints (e2e)', () => {
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
      },
      {
        id: 'u-sales-1',
        email: 'sales1@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Sally',
        lastName: 'Sales'
      },
      {
        id: 'u-sales-2',
        email: 'sales2@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Sam',
        lastName: 'Sales'
      }
    ],
    memberships: [
      { userId: 'u-admin', dealershipId: 'd-1', role: Role.ADMIN },
      { userId: 'u-sales-1', dealershipId: 'd-1', role: Role.SALES },
      { userId: 'u-sales-2', dealershipId: 'd-2', role: Role.SALES }
    ] as Membership[],
    leadSources: [] as LeadSourceState[],
    leads: [
      {
        id: 'lead-d1',
        dealershipId: 'd-1',
        sourceId: null,
        status: LeadStatus.NEW,
        assignedToUserId: 'u-sales-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        vehicleInterest: 'Mazda CX-5',
        lastActivityAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      },
      {
        id: 'lead-d2',
        dealershipId: 'd-2',
        sourceId: null,
        status: LeadStatus.NEW,
        assignedToUserId: null,
        firstName: 'Other',
        lastName: 'Tenant',
        email: 'other@example.com',
        phone: null,
        vehicleInterest: null,
        lastActivityAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ] as LeadState[],
    activities: [] as ActivityState[]
  };

  const buildLeadResponse = (lead: LeadState) => ({
    ...lead,
    source: state.leadSources.find((source) => source.id === lead.sourceId) ?? null,
    assignedToUser: lead.assignedToUserId
      ? (() => {
          const user = state.users.find((candidate) => candidate.id === lead.assignedToUserId);
          return user
            ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }
            : null;
        })()
      : null
  });


  const buildActivityResponse = (activity: ActivityState) => ({
    ...activity,
    createdByUser: (() => {
      const user = state.users.find((candidate) => candidate.id === activity.createdByUserId);
      return user
        ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }
        : null;
    })()
  });

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
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return state.memberships
          .filter((membership) => membership.dealershipId === where.dealershipId)
          .filter((membership) => (where.role?.in ? where.role.in.includes(membership.role) : true))
          .map((membership) => {
            const user = state.users.find((candidate) => candidate.id === membership.userId)!;
            return {
              role: membership.role,
              user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }
            };
          });
      })
    },
    leadSource: {
      upsert: jest.fn(async ({ where, create }: any) => {
        const key = where.dealershipId_name;
        const existing = state.leadSources.find(
          (source) => source.dealershipId === key.dealershipId && source.name === key.name
        );

        if (existing) {
          return existing;
        }

        const source: LeadSourceState = {
          id: `src-${state.leadSources.length + 1}`,
          dealershipId: create.dealershipId,
          name: create.name
        };
        state.leadSources.push(source);
        return source;
      })
    },
    lead: {
      findMany: jest.fn(async ({ where }: any) => {
        const filtered = state.leads.filter((lead) => {
          if (where.dealershipId && lead.dealershipId !== where.dealershipId) return false;
          if (where.status && lead.status !== where.status) return false;
          if (where.assignedToUserId && lead.assignedToUserId !== where.assignedToUserId) return false;
          return true;
        });

        return filtered.map(buildLeadResponse);
      }),
      create: jest.fn(async ({ data }: any) => {
        const lead: LeadState = {
          id: `lead-${state.leads.length + 1}`,
          dealershipId: data.dealershipId,
          sourceId: data.sourceId ?? null,
          status: data.status,
          assignedToUserId: data.assignedToUserId ?? null,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          vehicleInterest: data.vehicleInterest ?? null,
          lastActivityAt: data.lastActivityAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.leads.push(lead);
        return buildLeadResponse(lead);
      }),
      findFirst: jest.fn(async ({ where, select }: any) => {
        const lead = state.leads.find(
          (candidate) => candidate.id === where.id && candidate.dealershipId === where.dealershipId
        );

        if (!lead) return null;
        if (select) return { id: lead.id };
        return buildLeadResponse(lead);
      }),
      update: jest.fn(async ({ where, data, select }: any) => {
        const lead = state.leads.find((candidate) => candidate.id === where.id);
        if (!lead) {
          throw new Error('Lead not found');
        }

        Object.assign(lead, data, { updatedAt: new Date() });
        if (select) {
          return { id: lead.id };
        }
        return buildLeadResponse(lead);
      })
    },
    activity: {
      findMany: jest.fn(async ({ where }: any) => {
        return state.activities
          .filter((activity) => activity.leadId === where.leadId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(buildActivityResponse);
      }),
      create: jest.fn(async ({ data }: any) => {
        const activity: ActivityState = {
          id: `act-${state.activities.length + 1}`,
          type: data.type,
          subject: data.subject,
          body: data.body ?? null,
          outcome: data.outcome ?? null,
          createdByUserId: data.createdByUserId,
          leadId: data.leadId,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.activities.push(activity);
        return buildActivityResponse(activity);
      })
    },
    $transaction: jest.fn(async (operations: any[]) => Promise.all(operations)),
    auditLog: {
      create: jest.fn(async ({ data }: any) => ({ id: `audit-${Date.now()}`, createdAt: new Date(), ...data }))
    },
    eventLog: {
      create: jest.fn(async ({ data }: any) => ({ id: `event-${Date.now()}`, ...data })),
      findMany: jest.fn(async ({ where }: any) => [])
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

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('supports lead CRUD + assignment + status with dealership scoping', async () => {
    const accessToken = await loginAsAdmin();

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe('lead-d1');

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        firstName: 'Chris',
        lastName: 'Buyer',
        email: 'chris@example.com',
        phone: '555-8888',
        source: 'AutoTrader',
        vehicleInterest: 'Mazda CX-50',
        assignedToUserId: 'u-sales-1'
      })
      .expect(201);

    expect(createRes.body.dealershipId).toBe('d-1');
    expect(createRes.body.source.name).toBe('AutoTrader');
    expect(prismaMock.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dealershipId: 'd-1',
          eventType: 'lead_created',
          entityType: 'Lead'
        })
      })
    );

    const leadId = createRes.body.id;

    await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ status: LeadStatus.CONTACTED, vehicleInterest: 'Mazda CX-70' })
      .expect(200);

    expect(patchRes.body.status).toBe(LeadStatus.CONTACTED);

    const assignRes = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/assign`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ assignedToUserId: 'u-sales-1' })
      .expect(201);

    expect(assignRes.body.assignedToUser.id).toBe('u-sales-1');

    const statusRes = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ status: LeadStatus.QUALIFIED })
      .expect(201);

    expect(statusRes.body.status).toBe(LeadStatus.QUALIFIED);

    const createActivityRes = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        type: ActivityType.CALL,
        subject: 'First contact call',
        body: 'Discussed preferred trim and budget.',
        outcome: 'Appointment proposed'
      })
      .expect(201);

    expect(createActivityRes.body.leadId).toBe(leadId);
    expect(createActivityRes.body.createdByUser.id).toBe('u-admin');

    const listActivitiesRes = await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(listActivitiesRes.body).toHaveLength(1);
    expect(listActivitiesRes.body[0].type).toBe(ActivityType.CALL);

    const leadAfterActivityRes = await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(leadAfterActivityRes.body.lastActivityAt).not.toBeNull();

    await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-2')
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-2')
      .expect(403);
  });

  it('returns lead options scoped to dealership', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/leads/options')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(response.body.statuses).toContain('NEW');
    expect(response.body.leadTypes).toContain('GENERAL');
    expect(response.body.assignableUsers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'u-admin' }), expect.objectContaining({ id: 'u-sales-1' })])
    );
    expect(response.body.assignableUsers).toEqual(expect.not.arrayContaining([expect.objectContaining({ id: 'u-sales-2' })]));
  });

});
