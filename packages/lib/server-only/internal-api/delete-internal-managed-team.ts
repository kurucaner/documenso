import { prisma } from '@documenso/prisma';
import { OrganisationGroupType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { orphanEnvelopes } from '../envelope/orphan-envelopes';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type DeleteInternalManagedTeamOptions = {
  managedExternalId: string;
  teamUrl: string;
};

const normalizeTeamUrl = (teamUrl: string): string => teamUrl.trim().toLowerCase();

export const deleteInternalManagedTeam = async ({
  managedExternalId,
  teamUrl,
}: DeleteInternalManagedTeamOptions): Promise<void> => {
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
      organisationId: true,
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

  if (team.managedExternalId !== normalizedExternalId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  await orphanEnvelopes({ teamId: team.id });

  await prisma.$transaction(async (tx) => {
    await tx.team.delete({
      where: {
        id: team.id,
      },
    });

    await tx.organisationGroup.deleteMany({
      where: {
        organisationId: team.organisationId,
        teamGroups: {
          none: {},
        },
        type: OrganisationGroupType.INTERNAL_TEAM,
      },
    });
  });
};
