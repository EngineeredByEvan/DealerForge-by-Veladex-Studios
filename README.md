# DealerForge Monorepo Scaffold

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
- All endpoints except `/health` and `/auth/*` also require `X-Dealership-Id`.
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
pnpm build
pnpm test
```
