import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

const ORGANISATION_DELETION_MANAGED_MESSAGE = 'Organisation deletion is managed by PropertyOS';

export type OrganisationDeletionGuardInput = {
  propertyOsManaged: boolean;
  hasPropertyOsManagedTeam: boolean;
};

/**
 * Throws if dashboard organisation deletion is blocked for PropertyOS-managed resources.
 */
export const assertOrganisationDeletionAllowed = (input: OrganisationDeletionGuardInput): void => {
  if (input.propertyOsManaged || input.hasPropertyOsManagedTeam) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: ORGANISATION_DELETION_MANAGED_MESSAGE,
      statusCode: 403,
    });
  }
};

export type AssertOrganisationDeletionAllowedByIdOptions = {
  organisationId: string;
};

/**
 * Re-queries the organisation and managed teams before delete.
 */
export const assertOrganisationDeletionAllowedById = async ({
  organisationId,
}: AssertOrganisationDeletionAllowedByIdOptions): Promise<void> => {
  const organisation = await prisma.organisation.findFirst({
    where: { id: organisationId },
    select: {
      propertyOsManaged: true,
      teams: {
        select: { id: true },
        take: 1,
        where: { propertyOsManaged: true },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
      statusCode: 404,
    });
  }

  assertOrganisationDeletionAllowed({
    hasPropertyOsManagedTeam: organisation.teams.length > 0,
    propertyOsManaged: organisation.propertyOsManaged,
  });
};
