import {
  assertManagedOrganisationDashboardWriteAllowed,
  assertManagedOrganisationDashboardWriteAllowedByTeamId,
} from '../organisation/assert-managed-organisation-dashboard-write-allowed';

/**
 * Throws if dashboard team deletion is blocked for an integration-managed organisation.
 */
export const assertTeamDeletionAllowed = (team: { organisationIsManaged: boolean }): void => {
  assertManagedOrganisationDashboardWriteAllowed({
    isManaged: team.organisationIsManaged,
  });
};

export type AssertTeamDeletionAllowedByIdOptions = {
  teamId: number;
};

/**
 * Re-queries the team organisation flag before delete.
 */
export const assertTeamDeletionAllowedById = async ({
  teamId,
}: AssertTeamDeletionAllowedByIdOptions): Promise<void> => {
  await assertManagedOrganisationDashboardWriteAllowedByTeamId({ teamId });
};
