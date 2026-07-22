CREATE TABLE "ContainerType" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContainerType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Carrier" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesAgent" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAgent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Position" ADD COLUMN "containerTypeId" INTEGER;
ALTER TABLE "Position" ADD COLUMN "carrierId" INTEGER;
ALTER TABLE "Position" ADD COLUMN "salesAgentId" INTEGER;

CREATE UNIQUE INDEX "ContainerType_organizationId_name_key" ON "ContainerType"("organizationId", "name");
CREATE UNIQUE INDEX "Carrier_organizationId_name_key" ON "Carrier"("organizationId", "name");
CREATE UNIQUE INDEX "SalesAgent_organizationId_name_key" ON "SalesAgent"("organizationId", "name");

ALTER TABLE "ContainerType"
ADD CONSTRAINT "ContainerType_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Carrier"
ADD CONSTRAINT "Carrier_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesAgent"
ADD CONSTRAINT "SalesAgent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Position"
ADD CONSTRAINT "Position_containerTypeId_fkey"
FOREIGN KEY ("containerTypeId") REFERENCES "ContainerType"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Position"
ADD CONSTRAINT "Position_carrierId_fkey"
FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Position"
ADD CONSTRAINT "Position_salesAgentId_fkey"
FOREIGN KEY ("salesAgentId") REFERENCES "SalesAgent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
