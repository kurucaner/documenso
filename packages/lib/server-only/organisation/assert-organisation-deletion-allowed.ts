import {
  assertManagedOrganisationDashboardWriteAllowed,
  assertManagedOrganisationDashboardWriteAllowedById,
} from './assert-managed-organisation-dashboard-write-allowed';

export type OrganisationDeletionGuardInput = {
  isManaged: boolean;
};

/**
 * Throws if dashboard organisation deletion is blocked for integration-managed resources.
 */
export const assertOrganisationDeletionAllowed = (input: OrganisationDeletionGuardInput): void => {
  assertManagedOrganisationDashboardWriteAllowed({
    isManaged: input.isManaged,
  });
};

export type AssertOrganisationDeletionAllowedByIdOptions = {
  organisationId: string;
};

/**
 * Re-queries the organisation before delete.
 */
export const assertOrganisationDeletionAllowedById = async (
  options: AssertOrganisationDeletionAllowedByIdOptions,
): Promise<void> => {
  await assertManagedOrganisationDashboardWriteAllowedById(options);
};
