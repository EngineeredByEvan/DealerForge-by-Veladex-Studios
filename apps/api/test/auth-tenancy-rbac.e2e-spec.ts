import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

type Membership = {
  userId: string;
  dealershipId: string;
  role: Role;
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
        lastName: 'User'
      },
      {
        id: 'u-sales',
        email: 'sales@test.com',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        refreshTokenHash: null as string | null,
        firstName: 'Sales',
        lastName: 'User'
      }
    ],
    memberships: [
      { userId: 'u-admin', dealershipId: 'd-1', role: Role.ADMIN },
      { userId: 'u-sales', dealershipId: 'd-1', role: Role.SALES }
    ] as Membership[]
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
});
