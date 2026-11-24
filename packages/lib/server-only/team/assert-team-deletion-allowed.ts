import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

const TEAM_DELETION_MANAGED_MESSAGE = 'Team deletion is managed by PropertyOS';

/**
 * Throws if dashboard team deletion is blocked for a PropertyOS-managed team.
 */
export const assertTeamDeletionAllowed = (team: { organisationIsManaged: boolean }): void => {
  if (team.organisationIsManaged) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: TEAM_DELETION_MANAGED_MESSAGE,
      statusCode: 403,
    });
  }
};

export type AssertTeamDeletionAllowedByIdOptions = {
  teamId: number;
};

/**
 * Re-queries the team so a freshly-updated flag cannot be bypassed via a stale session.
 */
export const assertTeamDeletionAllowedById = async ({
  teamId,
}: AssertTeamDeletionAllowedByIdOptions): Promise<void> => {
  const team = await prisma.team.findFirst({
    select: {
      organisation: {
        select: {
          isManaged: true,
        },
      },
    },
    where: { id: teamId },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
      statusCode: 404,
    });
  }

  assertTeamDeletionAllowed({ organisationIsManaged: team.organisation.isManaged });
};
