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
   pnpm --filter @dealerforge/api prisma:migrate -- --name init
   ```


For production/staging deploys, apply committed migrations with:

```bash
pnpm --filter @dealerforge/api prisma:deploy
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

   Platform credentials for dealership provisioning:

   - `admin@dealerforge.local` (Platform Admin)
   - `operator@dealerforge.local` (Platform Operator)

### Reseed with Plaza Auto Group rooftops

Run this from repo root to reset and reseed the API database:

```bash
pnpm --filter @dealerforge/api prisma migrate reset --force
```

Then verify the Plaza Auto Group rooftops are present:

```bash
pnpm --filter @dealerforge/api exec prisma db seed
pnpm --filter @dealerforge/api exec prisma studio
```

Plaza Auto Group seeded dealerships (timezone `America/Toronto`, status `ACTIVE`):

- `bolton-kia`
- `cobourg-kia`
- `plaza-kia`
- `orillia-kia`
- `orillia-volkswagen`
- `subaru-of-orillia`
- `hwy-11-ram`
- `get-auto-finance`

## Run the monorepo

### 1) Infrastructure services (Docker Compose)

Start PostgreSQL + Redis first:

```bash
docker compose up -d
```

### 2) Install + database bootstrap

```bash
pnpm install
pnpm --filter @dealerforge/api prisma:generate
pnpm --filter @dealerforge/api prisma:migrate -- --name init
pnpm --filter @dealerforge/api prisma:seed
```

### 3) Run apps (combined or individually)

Run all apps together:

```bash
pnpm dev
```

Or run each service in separate terminals:

```bash
pnpm --filter @dealerforge/api dev
pnpm --filter @dealerforge/web dev
pnpm --filter @dealerforge/worker dev
```

- Web: http://localhost:3000/login
- API: http://localhost:4000/api/v1/health
- Worker: runs against Redis at `REDIS_URL`

## Environment variables

Required variables are documented in `.env.example`:

- Shared/runtime: `NODE_ENV`
- Database: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`
- Redis: `REDIS_PORT`, `REDIS_URL`
- API: `API_PORT`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN` (optional, defaults to `http://localhost:3000`)
- Communications: `COMMUNICATIONS_MODE` (`mock` by default), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_AUTH_TOKEN`
- Web: `WEB_PORT`, `NEXT_PUBLIC_API_BASE_URL`
- Worker: `WORKER_CONCURRENCY`

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
- `POST /api/v1/platform/dealerships` requires a dealership-scoped `ADMIN` role; platform users cannot create dealerships directly.

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

If you see `Nest can't resolve dependencies of the AuditService (PrismaService)` DI error, these are the checks:
- `apps/api/src/common/prisma/prisma.module.ts` must provide and export `PrismaService`.
- `apps/api/src/common/prisma/prisma.service.ts` must be the only `PrismaService` implementation and be marked `@Injectable()`.
- `apps/api/src/modules/audit/audit.module.ts` must import `PrismaModule` (or rely on global Prisma module wiring).
- `apps/api/src/app.module.ts` should import `PrismaModule` once so bootstrap wiring stays explicit.
- All API imports should reference `../../common/prisma/prisma.service` (single token/path).


## Troubleshooting

- **Next.js build error in `AppShell` (`Type 'null' is not assignable to type 'Element'`)**
  - `apps/web/src/components/app-shell.tsx` now types the component return as `JSX.Element | null` so conditional early returns (`return null`) are valid during static type checking and `next build` can pass.

- **API boot fails resolving `AuditService` -> `PrismaService`**
  - `apps/api/src/modules/audit/audit.module.ts` now provides `AuditService` through a factory that checks whether `PrismaService` can be resolved at runtime.
  - If Prisma is available, audit runs in `PRISMA` mode and uses database-backed logging.
  - If Prisma is not available, audit runs in `NOOP` mode so Nest bootstrap is not blocked (temporary fallback).
  - On startup, a diagnostic log is emitted: `AuditService running in PRISMA mode` or `AuditService running in NOOP mode`.
  - TODO is documented in `apps/api/src/modules/audit/audit.service.ts` to restore strict Prisma-backed logging once DI wiring is stable in all runtime paths.

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


## SMS / Twilio local testing

- Default mode is `COMMUNICATIONS_MODE=mock`, so outbound SMS uses fake SIDs and does not call Twilio.
- To enable real Twilio calls, set `COMMUNICATIONS_MODE=twilio` and configure credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) plus dealership Twilio sender settings.
- Twilio webhooks are available at:
  - `POST /api/v1/webhooks/twilio/sms/inbound`
  - `POST /api/v1/webhooks/twilio/sms/status`
- For local webhook testing, expose your API via ngrok and configure Twilio webhook URLs to your ngrok public URL.
