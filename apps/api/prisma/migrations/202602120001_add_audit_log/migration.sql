CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "dealershipId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_dealershipId_fkey"
    FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AuditLog_dealershipId_createdAt_idx" ON "AuditLog"("dealershipId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_dealershipId_action_idx" ON "AuditLog"("dealershipId", "action");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
