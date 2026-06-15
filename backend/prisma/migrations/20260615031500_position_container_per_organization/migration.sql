DROP INDEX IF EXISTS "Position_containerNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Position_organizationId_containerNumber_key"
ON "Position"("organizationId", "containerNumber");
