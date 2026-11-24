-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN "propertyOsManaged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "propertyOsManaged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Team" ADD COLUMN "propertyOsPropertyId" TEXT;