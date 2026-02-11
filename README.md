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

5. (Optional first run) create initial migration:

   ```bash
   pnpm --filter @dealerforge/api prisma:migrate --name init
   ```

## Run the monorepo

Start all apps with one command:

```bash
pnpm dev
```

- Web: http://localhost:3000/dashboard
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

## Quality checks

Run all workspace checks:

```bash
pnpm lint
pnpm build
pnpm test
```

## API endpoint scaffolded

- `GET /api/v1/health` returns:

```json
{
  "status": "ok",
  "service": "api",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```
