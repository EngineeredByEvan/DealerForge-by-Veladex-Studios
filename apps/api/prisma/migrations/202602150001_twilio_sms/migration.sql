-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- AlterTable
ALTER TABLE "Dealership"
ADD COLUMN "twilioAccountSid" TEXT,
ADD COLUMN "twilioAuthToken" TEXT,
ADD COLUMN "twilioMessagingServiceSid" TEXT,
ADD COLUMN "twilioFromPhone" TEXT;

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "provider" TEXT,
ADD COLUMN "errorCode" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "toPhone" TEXT,
ADD COLUMN "fromPhone" TEXT;

-- Migrate existing status values to enum through temp column
ALTER TABLE "Message" ADD COLUMN "status_new" "MessageStatus";
UPDATE "Message" SET "status_new" = CASE
  WHEN UPPER("status") = 'QUEUED' THEN 'QUEUED'::"MessageStatus"
  WHEN UPPER("status") = 'DELIVERED' THEN 'DELIVERED'::"MessageStatus"
  WHEN UPPER("status") = 'FAILED' THEN 'FAILED'::"MessageStatus"
  WHEN UPPER("status") = 'RECEIVED' THEN 'RECEIVED'::"MessageStatus"
  ELSE 'SENT'::"MessageStatus"
END;
ALTER TABLE "Message" DROP COLUMN "status";
ALTER TABLE "Message" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Message" ALTER COLUMN "status" SET NOT NULL;
