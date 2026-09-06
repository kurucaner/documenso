import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { createPersonalOrganisation } from '../organisation/create-organisation';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type CreateInternalOrganisationForUserOptions = {
  organisationName: string;
  orgUrl?: string;
  teamName?: string;
  teamUrl?: string;
  userId: number;
};

export type CreateInternalOrganisationForUserResult = {
  organisationId: string;
  orgUrl: string;
  teamUrl: string;
  userId: number;
};

export const createInternalOrganisationForUser = async ({
  organisationName,
  orgUrl,
  teamName,
  teamUrl,
  userId,
}: CreateInternalOrganisationForUserOptions): Promise<CreateInternalOrganisationForUserResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  const organisation = await createPersonalOrganisation({
    organisationName,
    orgUrl,
    teamName,
    teamUrl,
    throwErrorOnOrganisationCreationFailure: true,
    userId,
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to create organisation for user',
    });
  }

  const team = await prisma.team.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      url: true,
    },
    where: {
      organisationId: organisation.id,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to resolve team after organisation creation',
    });
  }

  return {
    organisationId: organisation.id,
    orgUrl: organisation.url,
    teamUrl: team.url,
    userId,
  };
};
