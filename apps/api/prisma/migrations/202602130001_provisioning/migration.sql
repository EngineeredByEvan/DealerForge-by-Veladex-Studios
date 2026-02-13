-- CreateEnum
CREATE TYPE "DealershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BDC';

-- AlterTable
ALTER TABLE "Dealership"
ADD COLUMN "slug" TEXT,
ADD COLUMN "status" "DealershipStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

UPDATE "Dealership"
SET "slug" = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

ALTER TABLE "Dealership"
ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserDealershipRole"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dealership_slug_key" ON "Dealership"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_dealershipId_status_idx" ON "Invitation"("dealershipId", "status");

-- CreateIndex
CREATE INDEX "Invitation_email_status_idx" ON "Invitation"("email", "status");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
