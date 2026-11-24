import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

const ORGANISATION_DELETION_MANAGED_MESSAGE = 'Organisation deletion is managed by PropertyOS';

export type OrganisationDeletionGuardInput = {
  isManaged: boolean;
};

/**
 * Throws if dashboard organisation deletion is blocked for integration-managed resources.
 */
export const assertOrganisationDeletionAllowed = (input: OrganisationDeletionGuardInput): void => {
  if (input.isManaged) {
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
    select: {
      isManaged: true,
    },
    where: { id: organisationId },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
      statusCode: 404,
    });
  }

  assertOrganisationDeletionAllowed({
    isManaged: organisation.isManaged,
  });
};
