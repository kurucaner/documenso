-- Rename integration control-plane columns to vendor-neutral names.
ALTER TABLE "Organisation" RENAME COLUMN "propertyOsManaged" TO "isManaged";

ALTER TABLE "Team" RENAME COLUMN "propertyOsPropertyId" TO "managedExternalId";

ALTER TABLE "Team" DROP COLUMN "propertyOsManaged";