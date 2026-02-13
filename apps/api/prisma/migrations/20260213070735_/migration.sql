/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `AutoGroup` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Dealership" ADD COLUMN     "businessHours" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AutoGroup_name_key" ON "AutoGroup"("name");
