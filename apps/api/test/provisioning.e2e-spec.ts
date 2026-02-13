import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Provisioning flows (e2e)', () => {
  let app: INestApplication;

  const state = {
    users: [
      { id: 'u-platform', email: 'platform@test.com', passwordHash: bcrypt.hashSync('Password123!', 10), refreshTokenHash: null as string | null, firstName: 'Plat', lastName: 'Admin', isPlatformAdmin: true, isPlatformOperator: false },
      { id: 'u-dealer-admin', email: 'dealer-admin@test.com', passwordHash: bcrypt.hashSync('Password123!', 10), refreshTokenHash: null as string | null, firstName: 'Dealer', lastName: 'Admin', isPlatformAdmin: false, isPlatformOperator: false },
      { id: 'u-sales', email: 'sales@test.com', passwordHash: bcrypt.hashSync('Password123!', 10), refreshTokenHash: null as string | null, firstName: 'Sales', lastName: 'Rep', isPlatformAdmin: false, isPlatformOperator: false },
      { id: 'u-operator', email: 'operator@test.com', passwordHash: bcrypt.hashSync('Password123!', 10), refreshTokenHash: null as string | null, firstName: 'Plat', lastName: 'Operator', isPlatformAdmin: false, isPlatformOperator: true }
    ],
    autoGroups: [{ id: 'ag-1', name: 'Default Auto Group', createdAt: new Date() }],
    dealerships: [{ id: 'd-1', autoGroupId: 'ag-1', name: 'Store One', slug: 'store-one', timezone: 'UTC', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() }],
    memberships: [
      { id: 'm-1', userId: 'u-dealer-admin', dealershipId: 'd-1', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'm-2', userId: 'u-sales', dealershipId: 'd-1', role: 'SALES', isActive: true, createdAt: new Date(), updatedAt: new Date() }
    ],
    invitations: [] as Array<any>
  };

  const prismaMock: any = {
    user: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const user = state.users.find((u) => u.id === where?.id || u.email === where?.email);
        if (!user) return null;
        if (include?.dealerships) {
          return {
            ...user,
            dealerships: state.memberships
              .filter((m) => m.userId === user.id)
              .map((m) => ({ ...m, dealership: { id: m.dealershipId, name: 'Store One' } }))
          };
        }
        return user;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        if (!user) return null;
        Object.assign(user, data);
        return user;
      }),
      create: jest.fn(async ({ data }: any) => {
        const user = { id: `u-${state.users.length + 1}`, refreshTokenHash: null, isPlatformAdmin: false, ...data };
        state.users.push(user as any);
        return user;
      })
    },
    userDealershipRole: {
      findFirst: jest.fn(async ({ where }: any) => state.memberships.find((m) => m.userId === where.userId && m.dealershipId === where.dealershipId && (where.isActive === undefined || m.isActive === where.isActive)) ?? null),
      findMany: jest.fn(async ({ where }: any) => state.memberships.filter((m) => m.dealershipId === where.dealershipId).map((m) => ({ ...m, user: state.users.find((u) => u.id === m.userId) }))),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const found = state.memberships.find((m) => m.userId === where.userId_dealershipId.userId && m.dealershipId === where.userId_dealershipId.dealershipId);
        if (found) { Object.assign(found, update); return found; }
        const item = { id: `m-${state.memberships.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...create };
        state.memberships.push(item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const found = state.memberships.find((m) => m.userId === where.userId_dealershipId.userId && m.dealershipId === where.userId_dealershipId.dealershipId);
        if (!found) throw new Error('not found');
        Object.assign(found, data);
        return found;
      })
    },
    autoGroup: {
      findFirst: jest.fn(async () => state.autoGroups[0]),
      create: jest.fn(async ({ data }: any) => ({ id: 'ag-2', ...data }))
    },
    dealership: {
      create: jest.fn(async ({ data }: any) => {
        const d = { id: `d-${state.dealerships.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.dealerships.push(d as any);
        return d;
      }),
      findMany: jest.fn(async () => state.dealerships),
      update: jest.fn(async ({ where, data }: any) => {
        const found = state.dealerships.find((d) => d.id === where.id)!;
        Object.assign(found, data);
        return found;
      })
    },

    leadSource: {
      createMany: jest.fn(async () => ({ count: 3 }))
    },
    $transaction: jest.fn(async (operation: any) => operation(prismaMock)),
    invitation: {
      create: jest.fn(async ({ data }: any) => {
        const inv = { id: `i-${state.invitations.length + 1}`, createdAt: new Date(), updatedAt: new Date(), status: 'PENDING', ...data };
        state.invitations.push(inv);
        return inv;
      }),
      findUnique: jest.fn(async ({ where }: any) => state.invitations.find((i) => i.token === where.token) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const inv = state.invitations.find((i) => i.id === where.id)!;
        Object.assign(inv, data);
        return inv;
      })
    },
    lead: { findMany: jest.fn(async () => []) }
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

  it('platform operator can create dealership', async () => {
    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'operator@test.com', password: 'Password123!' }).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/platform/dealerships')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ name: 'Store Two', slug: 'store-two', timezone: 'America/Toronto' })
      .expect(201);
  });

  it('platform admin can create dealership', async () => {
    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'platform@test.com', password: 'Password123!' }).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/platform/dealerships')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ name: 'Store Two', slug: 'store-two', timezone: 'America/Toronto' })
      .expect(201);
  });

  it('dealership admin can manage team only inside their dealership', async () => {
    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'dealer-admin@test.com', password: 'Password123!' }).expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/team/users')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('x-dealership-id', 'd-1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/team/users')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .set('x-dealership-id', 'd-999')
      .expect(403);
  });

  it('non-operator is forbidden on platform provisioning endpoint', async () => {
    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'sales@test.com', password: 'Password123!' }).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/platform/dealerships')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ name: 'Store Four', slug: 'store-four', timezone: 'UTC' })
      .expect(403);
  });
});
