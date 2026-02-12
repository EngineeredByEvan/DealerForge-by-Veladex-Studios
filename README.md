# DealerForge Monorepo Scaffold

[![CI](https://github.com/Veladex-Studios/DealerForge-by-Veladex-Studios/actions/workflows/ci.yml/badge.svg)](https://github.com/Veladex-Studios/DealerForge-by-Veladex-Studios/actions/workflows/ci.yml)

This repository is scaffolded for the DealerForge CRM + AI Automation platform with:

- `apps/web`: Next.js dashboard frontend
- `apps/api`: NestJS API with Prisma
- `apps/worker`: BullMQ worker
- `packages/shared`: shared types and Zod validators

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

## Local setup

1. Copy environment values:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start infrastructure (PostgreSQL + Redis):

   ```bash
   docker compose up -d
   ```

4. Generate Prisma client:

   ```bash
   pnpm --filter @dealerforge/api prisma:generate
   ```

5. Run migrations:

   ```bash
   pnpm --filter @dealerforge/api prisma:migrate --name init
   ```

6. Seed Phase 1 foundation data:

   ```bash
   pnpm --filter @dealerforge/api prisma:seed
   ```

   Seeded users (all password `Password123!`):

   - `admin@dealerforge.local` (ADMIN)
   - `manager@dealerforge.local` (MANAGER)
   - `sales1@dealerforge.local` (SALES)
   - `sales2@dealerforge.local` (SALES)

## Run the monorepo

Start all apps with one command:

```bash
pnpm dev
```

- Web: http://localhost:3000/login
- API: http://localhost:4000/api/v1/health
- Worker: runs against Redis at `REDIS_URL`

## Environment variables

Required variables are documented in `.env.example`:

- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `NEXT_PUBLIC_API_BASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

## Auth + tenancy + RBAC (Phase 1)

### Authentication endpoints

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Tenancy resolution strategy (v1)

Primary strategy: `X-Dealership-Id` request header.

- All non-public endpoints require a valid JWT access token.
- All endpoints except `/health` and public integration webhooks require `X-Dealership-Id`.
- `POST /auth/login` and `POST /auth/refresh` are public and skip tenant resolution by design.
- The `TenantGuard` validates the authenticated user has membership in that dealership (`UserDealershipRole`).
- On success, guard attaches `tenant` context to request: `{ dealershipId, role }`.
- Service layer methods must explicitly accept `dealershipId` and include it in all Prisma `where`/`data` clauses.

### RBAC strategy (v1)

- Roles are stored in `UserDealershipRole.role` enum (`ADMIN`, `MANAGER`, `SALES`).
- Use `@Roles(...)` on protected handlers.
- `RolesGuard` reads active tenant role and enforces role constraints.

## Quality checks

Run all workspace checks:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Notes:
- `@dealerforge/api` now runs `prisma generate` automatically before `typecheck` and `build` so Prisma client changes (including `AuditLog`) stay in sync.
- `@dealerforge/shared` must be built for emitted JS/types (`pnpm --filter @dealerforge/shared build`) when consuming package outputs directly.


## CI workflow

GitHub Actions runs `.github/workflows/ci.yml` on every pull request and on pushes to `main`.

CI executes the monorepo checks in this order:

1. `pnpm install`
2. `pnpm -r lint`
3. `pnpm -r typecheck`
4. `pnpm -r build`
5. `pnpm --filter @dealerforge/api prisma:generate`
6. `pnpm --filter @dealerforge/api exec prisma migrate dev --name ci --skip-seed`
7. `pnpm --filter @dealerforge/api test:e2e`

For API test infrastructure, the workflow starts PostgreSQL and Redis service containers and injects:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dealerforge_ci?schema=public`
- `REDIS_URL=redis://localhost:6379`


## v1 usage flow

1. Sign in at `http://localhost:3000/login` with a seeded user.
2. Pick a dealership from the global selector in the top navigation.
3. Use **Dashboard** for tenant health and KPI snapshots.
4. Use **Leads** to quick-add a lead, then open the lead detail and quick-add activity/task/appointment.
5. Use **Tasks** and **Appointments** to execute follow-up workflows.
6. Use **Integrations** to configure webhook providers or import CSV leads.
7. Managers/Admins can review recent user/system actions at `GET /api/v1/audit`.

### Screenshot placeholders

- `[placeholder] Dashboard with top nav and dealership selector`
- `[placeholder] Leads list with quick add`
- `[placeholder] Lead detail quick add actions`
- `[placeholder] Integrations settings and webhook secret`
- `[placeholder] Audit log endpoint response`
