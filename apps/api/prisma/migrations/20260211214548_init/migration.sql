-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'SALES');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_SET', 'NEGOTIATING', 'SOLD', 'LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'SMS', 'NOTE', 'VISIT', 'TEST_DRIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'SNOOZED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SET', 'CONFIRMED', 'SHOWED', 'NO_SHOW', 'CANCELED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GENERIC', 'AUTOTRADER', 'CARGURUS', 'OEM_FORM', 'REFERRAL');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('lead_summary', 'lead_score', 'draft_followup', 'next_best_action');

-- CreateTable
CREATE TABLE "AutoGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dealership" (
    "id" TEXT NOT NULL,
    "autoGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDealershipRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDealershipRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedToUserId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vehicleInterest" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "integrationId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "parsedPayload" JSONB,
    "parsedOk" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "leadId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SET',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "lead_id" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "outcome" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRequestLog" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "resultPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserDealershipRole_dealershipId_idx" ON "UserDealershipRole"("dealershipId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDealershipRole_userId_dealershipId_key" ON "UserDealershipRole"("userId", "dealershipId");

-- CreateIndex
CREATE INDEX "LeadSource_dealershipId_idx" ON "LeadSource"("dealershipId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_dealershipId_name_key" ON "LeadSource"("dealershipId", "name");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_idx" ON "Lead"("dealershipId");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_status_idx" ON "Lead"("dealershipId", "status");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_assignedToUserId_idx" ON "Lead"("dealershipId", "assignedToUserId");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_sourceId_idx" ON "Lead"("dealershipId", "sourceId");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_lastActivityAt_idx" ON "Lead"("dealershipId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Integration_dealershipId_idx" ON "Integration"("dealershipId");

-- CreateIndex
CREATE INDEX "Integration_dealershipId_provider_idx" ON "Integration"("dealershipId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_dealershipId_name_key" ON "Integration"("dealershipId", "name");

-- CreateIndex
CREATE INDEX "IntegrationEvent_dealershipId_receivedAt_idx" ON "IntegrationEvent"("dealershipId", "receivedAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_dealershipId_provider_idx" ON "IntegrationEvent"("dealershipId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationEvent_integrationId_idx" ON "IntegrationEvent"("integrationId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_leadId_idx" ON "IntegrationEvent"("leadId");

-- CreateIndex
CREATE INDEX "Appointment_dealershipId_idx" ON "Appointment"("dealershipId");

-- CreateIndex
CREATE INDEX "Appointment_dealershipId_status_idx" ON "Appointment"("dealershipId", "status");

-- CreateIndex
CREATE INDEX "Appointment_dealershipId_start_at_idx" ON "Appointment"("dealershipId", "start_at");

-- CreateIndex
CREATE INDEX "Appointment_dealershipId_lead_id_idx" ON "Appointment"("dealershipId", "lead_id");

-- CreateIndex
CREATE INDEX "Task_dealershipId_idx" ON "Task"("dealershipId");

-- CreateIndex
CREATE INDEX "Task_dealershipId_status_idx" ON "Task"("dealershipId", "status");

-- CreateIndex
CREATE INDEX "Task_dealershipId_assignedToUserId_idx" ON "Task"("dealershipId", "assignedToUserId");

-- CreateIndex
CREATE INDEX "Task_dealershipId_leadId_idx" ON "Task"("dealershipId", "leadId");

-- CreateIndex
CREATE INDEX "Task_dealershipId_dueAt_idx" ON "Task"("dealershipId", "dueAt");

-- CreateIndex
CREATE INDEX "Activity_leadId_createdAt_idx" ON "Activity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_createdByUserId_idx" ON "Activity"("createdByUserId");

-- CreateIndex
CREATE INDEX "AIRequestLog_dealershipId_leadId_createdAt_idx" ON "AIRequestLog"("dealershipId", "leadId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRequestLog_dealershipId_feature_idx" ON "AIRequestLog"("dealershipId", "feature");

-- AddForeignKey
ALTER TABLE "Dealership" ADD CONSTRAINT "Dealership_autoGroupId_fkey" FOREIGN KEY ("autoGroupId") REFERENCES "AutoGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDealershipRole" ADD CONSTRAINT "UserDealershipRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDealershipRole" ADD CONSTRAINT "UserDealershipRole_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
