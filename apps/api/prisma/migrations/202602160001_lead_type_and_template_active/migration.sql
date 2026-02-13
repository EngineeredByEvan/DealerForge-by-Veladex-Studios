-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('NEW_VEHICLE', 'USED_VEHICLE', 'SERVICE', 'FINANCE', 'GENERAL', 'TRADE_IN');

-- AlterTable
ALTER TABLE "Lead"
  ADD COLUMN "leadType" "LeadType" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "soldAt" TIMESTAMP(3),
  ADD COLUMN "soldByUserId" TEXT,
  ADD COLUMN "leadScore" INTEGER;

ALTER TABLE "CommunicationTemplate"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Lead_dealershipId_leadType_idx" ON "Lead"("dealershipId", "leadType");
