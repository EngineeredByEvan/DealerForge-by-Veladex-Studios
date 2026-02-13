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
  firstName: string | null;
  lastName: string | null;
};

type AppointmentState = {
  id: string;
  dealershipId: string;
  status: AppointmentStatus;
  start_at: Date;
  end_at: Date;
  lead_id: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('Appointments endpoints (e2e)', () => {
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
      }
    ],
    memberships: [
      { userId: 'u-admin', dealershipId: 'd-1', role: Role.ADMIN },
      { userId: 'u-sales-1', dealershipId: 'd-2', role: Role.SALES }
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
    appointments: [
      {
        id: 'appt-d1',
        dealershipId: 'd-1',
        status: AppointmentStatus.SET,
        start_at: new Date('2026-03-01T10:00:00.000Z'),
        end_at: new Date('2026-03-01T10:30:00.000Z'),
        lead_id: 'lead-d1',
        note: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      },
      {
        id: 'appt-d2',
        dealershipId: 'd-2',
        status: AppointmentStatus.SET,
        start_at: new Date('2026-03-02T10:00:00.000Z'),
        end_at: new Date('2026-03-02T10:30:00.000Z'),
        lead_id: 'lead-d2',
        note: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ] as AppointmentState[]
  };

  const buildAppointmentResponse = (appointment: AppointmentState) => ({
    ...appointment,
    lead: appointment.lead_id
      ? (() => {
          const lead = state.leads.find((candidate) => candidate.id === appointment.lead_id);
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
    appointment: {
      findMany: jest.fn(async ({ where }: any) => {
        return state.appointments
          .filter((appointment) => {
            if (appointment.dealershipId !== where.dealershipId) return false;
            if (where.start_at?.gte && appointment.start_at < where.start_at.gte) return false;
            if (where.start_at?.lte && appointment.start_at > where.start_at.lte) return false;
            return true;
          })
          .map(buildAppointmentResponse);
      }),
      create: jest.fn(async ({ data }: any) => {
        const appointment: AppointmentState = {
          id: `appt-${state.appointments.length + 1}`,
          dealershipId: data.dealershipId,
          status: data.status,
          start_at: data.start_at,
          end_at: data.end_at,
          lead_id: data.lead_id ?? null,
          note: data.note ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        state.appointments.push(appointment);
        return buildAppointmentResponse(appointment);
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const appointment = state.appointments.find(
          (candidate) => candidate.id === where.id && candidate.dealershipId === where.dealershipId
        );

        if (!appointment) {
          return null;
        }

        return buildAppointmentResponse(appointment);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const appointment = state.appointments.find((candidate) => candidate.id === where.id);
        if (!appointment) {
          throw new Error('Appointment not found');
        }

        Object.assign(appointment, data, { updatedAt: new Date() });
        return buildAppointmentResponse(appointment);
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

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
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

  it('scopes list results by dealership and supports range filtering', async () => {
    const token = await loginAsAdmin();

    const allRes = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(allRes.body).toHaveLength(1);
    expect(allRes.body[0].id).toBe('appt-d1');

    const rangeRes = await request(app.getHttpServer())
      .get('/api/v1/appointments')
      .query({ range: '2026-03-01T00:00:00.000Z,2026-03-01T23:59:59.000Z' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(200);

    expect(rangeRes.body).toHaveLength(1);
    expect(rangeRes.body[0].id).toBe('appt-d1');
  });

  it('creates an appointment and enforces cross-tenant lead scoping', async () => {
    const token = await loginAsAdmin();

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        start_at: '2026-03-05T10:00:00.000Z',
        end_at: '2026-03-05T11:00:00.000Z',
        lead_id: 'lead-d1',
        note: 'Customer asked for test drive'
      })
      .expect(201);

    expect(createRes.body.status).toBe('SET');
    expect(createRes.body.lead_id).toBe('lead-d1');
    expect(prismaMock.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dealershipId: 'd-1',
          eventType: 'appointment_created',
          entityType: 'Appointment'
        })
      })
    );

    await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .send({
        start_at: '2026-03-06T10:00:00.000Z',
        end_at: '2026-03-06T11:00:00.000Z',
        lead_id: 'lead-d2'
      })
      .expect(400);
  });

  it('enforces status transitions for confirm and cancel', async () => {
    const token = await loginAsAdmin();

    const confirmed = await request(app.getHttpServer())
      .post('/api/v1/appointments/appt-d1/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(201);

    expect(confirmed.body.status).toBe('CONFIRMED');

    const canceled = await request(app.getHttpServer())
      .post('/api/v1/appointments/appt-d1/cancel')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(201);

    expect(canceled.body.status).toBe('CANCELED');

    await request(app.getHttpServer())
      .post('/api/v1/appointments/appt-d1/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(400);
  });
});
