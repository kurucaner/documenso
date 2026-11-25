import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getInternalTeam } from './get-internal-team';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type ClaimInternalManagedTeamOptions = {
  managedExternalId: string;
  teamUrl: string;
};

const normalizeTeamUrl = (teamUrl: string): string => teamUrl.trim().toLowerCase();

export const claimInternalManagedTeam = async ({ managedExternalId, teamUrl }: ClaimInternalManagedTeamOptions) => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const normalizedUrl = normalizeTeamUrl(teamUrl);
  const normalizedExternalId = managedExternalId.trim();

  if (!normalizedUrl || normalizedExternalId === '') {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Team URL and managedExternalId are required',
    });
  }

  const team = await prisma.team.findFirst({
    select: {
      id: true,
      managedExternalId: true,
      organisation: {
        select: {
          isManaged: true,
        },
      },
      url: true,
    },
    where: {
      url: normalizedUrl,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  if (!team.organisation.isManaged) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Team organisation is not integration-managed',
    });
  }

  const existingExternalId = team.managedExternalId?.trim() ?? '';

  if (existingExternalId === normalizedExternalId) {
    return getInternalTeam({
      teamReference: team.url,
    });
  }

  if (existingExternalId.length > 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Team is already linked to another external resource',
    });
  }

  const conflictingTeam = await prisma.team.findFirst({
    select: {
      id: true,
    },
    where: {
      id: {
        not: team.id,
      },
      managedExternalId: normalizedExternalId,
    },
  });

  if (conflictingTeam) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'managedExternalId is already linked to another team',
    });
  }

  await prisma.team.update({
    data: {
      managedExternalId: normalizedExternalId,
    },
    where: {
      id: team.id,
    },
  });

  return getInternalTeam({
    teamReference: team.url,
  });
};
