-- Add SUPER_ADMIN role
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "pib" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Seed default organization for existing data
INSERT INTO "Organization" ("name", "createdAt", "updatedAt")
SELECT 'Moja spedicija', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Organization");

-- Add nullable columns first so existing rows can be backfilled
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;
ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;

UPDATE "Company"
SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "id" LIMIT 1)
WHERE "organizationId" IS NULL;

UPDATE "Position"
SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "id" LIMIT 1)
WHERE "organizationId" IS NULL;

UPDATE "User"
SET "role" = 'SUPER_ADMIN'
WHERE "email" = 'admin@spedicija.local';

-- Make tenant ownership required for operational data
ALTER TABLE "Company" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Position" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Company"
ADD CONSTRAINT "Company_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Position"
ADD CONSTRAINT "Position_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User"
ADD CONSTRAINT "User_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
