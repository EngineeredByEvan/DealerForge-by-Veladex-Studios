import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

type Membership = {
  userId: string;
  dealershipId: string;
  role: 'ADMIN' | 'MANAGER' | 'BDC' | 'SALES';
  isActive?: boolean;
};

describe('Auth + tenancy + RBAC (e2e)', () => {
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
        isPlatformOperator: false,
        phone: null
      },
      {
        id: 'u-sales',
        email: 'sales@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Sales',
        lastName: 'User',
        isPlatformAdmin: false,
        isPlatformOperator: false,
        phone: null
      }
    ],
    memberships: [
      { userId: 'u-admin', dealershipId: 'd-1', role: 'ADMIN', isActive: true },
      { userId: 'u-sales', dealershipId: 'd-1', role: 'SALES', isActive: true }
    ] as Membership[],
    dealerships: [
      { id: 'd-1', name: 'Woodstock Mazda', slug: 'woodstock-mazda', timezone: 'UTC', status: 'ACTIVE', businessHours: null }
    ]
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

        user.refreshTokenHash = data.refreshTokenHash ?? user.refreshTokenHash ?? null;
        user.firstName = data.firstName ?? user.firstName;
        user.lastName = data.lastName ?? user.lastName;
        user.phone = data.phone === undefined ? user.phone : data.phone;
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
    dealership: {
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const dealership = state.dealerships.find((candidate) => candidate.id === where.id);
        if (!dealership) {
          throw new Error('Not found');
        }

        return dealership;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const dealership = state.dealerships.find((candidate) => candidate.id === where.id);
        if (!dealership) {
          throw new Error('Not found');
        }

        Object.assign(dealership, data);
        return dealership;
      })
    },
    lead: {
      findMany: jest.fn(async ({ where }: any) => [{ id: 'lead-1', dealershipId: where.dealershipId }])
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

  it('login + me flow works', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body.email).toBe('admin@test.com');
    expect(meRes.body.dealerships).toHaveLength(1);
    expect(meRes.body.platformRole).toBe('NONE');
    expect(meRes.body.isPlatformOperator).toBe(false);
  });

  it('blocks protected routes without dealership context', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(400);
  });


  it('blocks protected routes when user lacks access to provided dealership', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@test.com', password: 'Password123!' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('X-Dealership-Id', 'd-2')
      .expect(403);
  });

  it('blocks SALES role from ADMIN-only endpoint', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@test.com', password: 'Password123!' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .expect(403);
  });

  it('updates current user profile without tenant header', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@test.com', password: 'Password123!' })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ firstName: 'Updated', phone: '5551112222' })
      .expect(200);

    expect(updateRes.body.firstName).toBe('Updated');
    expect(updateRes.body.phone).toBe('5551112222');
  });

  it('persists businessHours JSON when dealership admin updates settings', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    const businessHours = {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' }
    };

    const updateRes = await request(app.getHttpServer())
      .patch('/api/v1/dealerships/d-1')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ businessHours })
      .expect(200);

    expect(updateRes.body.businessHours).toEqual(businessHours);
    expect(state.dealerships.find((candidate) => candidate.id === 'd-1')?.businessHours).toEqual(
      businessHours
    );
  });

  it('allows dealership admin to update their own dealership settings with tenant header', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch('/api/v1/dealerships/d-1')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ name: 'Updated Store', status: 'INACTIVE' })
      .expect(200);

    expect(updateRes.body.name).toBe('Updated Store');
    expect(updateRes.body.status).toBe('INACTIVE');
  });

  it('blocks dealership admin from updating another dealership', async () => {
    state.dealerships.push({
      id: 'd-2',
      name: 'Other Dealer',
      slug: 'other-dealer',
      timezone: 'UTC',
      status: 'ACTIVE',
      businessHours: null
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/api/v1/dealerships/d-2')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('X-Dealership-Id', 'd-1')
      .send({ name: 'Not Allowed' })
      .expect(403);
  });

});
