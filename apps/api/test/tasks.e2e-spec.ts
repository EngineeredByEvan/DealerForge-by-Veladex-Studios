import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { LeadStatus, Role, TaskStatus } from '@prisma/client';
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
  firstName: string | null;
  lastName: string | null;
};

type TaskState = {
  id: string;
  dealershipId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  assignedToUserId: string | null;
  leadId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('Tasks endpoints (e2e)', () => {
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
    leads: [
      { id: 'lead-d1', dealershipId: 'd-1', status: LeadStatus.NEW, firstName: 'Jane', lastName: 'Doe' },
      {
        id: 'lead-d2',
        dealershipId: 'd-2',
        status: LeadStatus.NEW,
        firstName: 'Other',
        lastName: 'Tenant'
      }
    ] as LeadState[],
    tasks: [
      {
        id: 'task-d1-open',
        dealershipId: 'd-1',
        title: 'Call Jane',
        description: null,
        status: TaskStatus.OPEN,
        dueAt: null,
        assignedToUserId: 'u-sales-1',
        leadId: 'lead-d1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      },
      {
        id: 'task-d2-open',
        dealershipId: 'd-2',
        title: 'Other store task',
        description: null,
        status: TaskStatus.OPEN,
        dueAt: null,
        assignedToUserId: 'u-sales-2',
        leadId: 'lead-d2',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ] as TaskState[]
  };

  const buildTaskResponse = (task: TaskState) => ({
    ...task,
    assignedToUser: task.assignedToUserId
      ? (() => {
          const user = state.users.find((candidate) => candidate.id === task.assignedToUserId);
          return user
            ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }
            : null;
        })()
      : null,
    lead: task.leadId
      ? (() => {
          const lead = state.leads.find((candidate) => candidate.id === task.leadId);
          return lead
            ? {
                id: lead.id,
                firstName: lead.firstName,
                lastName: lead.lastName,
                status: lead.status
              }
            : null;
        })()
      : null
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
      })
    },
    lead: {
      findFirst: jest.fn(async ({ where, select }: any) => {
        const lead = state.leads.find(
          (candidate) => candidate.id === where.id && candidate.dealershipId === where.dealershipId
        );

        if (!lead) return null;
        if (select) return { id: lead.id };
        return lead;
      })
    },
    task: {
      findMany: jest.fn(async ({ where }: any) => {
        return state.tasks
          .filter((task) => {
            if (task.dealershipId !== where.dealershipId) return false;
            if (where.status && task.status !== where.status) return false;
            if (where.assignedToUserId && task.assignedToUserId !== where.assignedToUserId) return false;
            if (where.leadId && task.leadId !== where.leadId) return false;
            return true;
          })
          .map(buildTaskResponse);
      }),
      create: jest.fn(async ({ data }: any) => {
        const task: TaskState = {
          id: `task-${state.tasks.length + 1}`,
          dealershipId: data.dealershipId,
          title: data.title,
          description: data.description ?? null,
          status: data.status ?? TaskStatus.OPEN,
          dueAt: data.dueAt ?? null,
          assignedToUserId: data.assignedToUserId ?? null,
          leadId: data.leadId ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.tasks.push(task);
        return buildTaskResponse(task);
      }),
      findFirst: jest.fn(async ({ where, select }: any) => {
        const task = state.tasks.find(
          (candidate) => candidate.id === where.id && candidate.dealershipId === where.dealershipId
        );

        if (!task) {
          return null;
        }

        if (select) {
          return { id: task.id };
        }

        return buildTaskResponse(task);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const task = state.tasks.find((candidate) => candidate.id === where.id);
        if (!task) {
          throw new Error('Task not found');
        }

        Object.assign(task, data, { updatedAt: new Date() });
        return buildTaskResponse(task);
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

  it('supports task CRUD-style flows with transition rules', async () => {
    const accessToken = await loginAsAdmin();

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe('task-d1-open');

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        title: 'Schedule test drive',
        description: 'Confirm Saturday morning',
        dueAt: '2026-02-01T12:00:00.000Z',
        assignedToUserId: 'u-sales-1',
        leadId: 'lead-d1'
      })
      .expect(201);

    expect(createRes.body.status).toBe(TaskStatus.OPEN);

    const createdTaskId = createRes.body.id;

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${createdTaskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ title: 'Schedule VIP test drive' })
      .expect(200);

    expect(patchRes.body.title).toBe('Schedule VIP test drive');

    const snoozeRes = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${createdTaskId}/snooze`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ dueAt: '2026-02-03T12:00:00.000Z' })
      .expect(201);

    expect(snoozeRes.body.status).toBe(TaskStatus.SNOOZED);

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${createdTaskId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(201);

    expect(completeRes.body.status).toBe(TaskStatus.DONE);

    await request(app.getHttpServer())
      .post(`/api/v1/tasks/${createdTaskId}/snooze`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ dueAt: '2026-02-05T12:00:00.000Z' })
      .expect(400);

    const canceledRes = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${createdTaskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ status: TaskStatus.CANCELED })
      .expect(200);

    expect(canceledRes.body.status).toBe(TaskStatus.CANCELED);

    await request(app.getHttpServer())
      .post(`/api/v1/tasks/${createdTaskId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(400);
  });

  it('enforces dealership scoping for task routes', async () => {
    const accessToken = await loginAsAdmin();

    await request(app.getHttpServer())
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-2')
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        title: 'Invalid cross-tenant lead',
        leadId: 'lead-d2'
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        title: 'Invalid cross-tenant assignee',
        assignedToUserId: 'u-sales-2'
      })
      .expect(400);
  });
});
