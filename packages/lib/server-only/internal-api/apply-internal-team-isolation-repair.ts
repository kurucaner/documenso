import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type ApplyInternalTeamIsolationRepairOptions = {
  orgUrl: string;
  teamUrl: string;
};

export type ApplyInternalTeamIsolationRepairResult = {
  alreadyIsolated: boolean;
  removedLinkCount: number;
  teamUrl: string;
};

export const applyInternalTeamIsolationRepair = async ({
  orgUrl,
  teamUrl,
}: ApplyInternalTeamIsolationRepairOptions): Promise<ApplyInternalTeamIsolationRepairResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const normalizedOrgUrl = orgUrl.trim();
  const normalizedTeamUrl = teamUrl.trim().toLowerCase();

  if (!normalizedOrgUrl || !normalizedTeamUrl) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'orgUrl and teamUrl are required',
    });
  }

  const team = await prisma.team.findFirst({
    where: {
      url: normalizedTeamUrl,
      organisation: {
        url: normalizedOrgUrl,
      },
    },
    select: {
      id: true,
      url: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const orgMemberInheritanceLinks = await prisma.teamGroup.findMany({
    where: {
      teamId: team.id,
      organisationGroup: {
        organisationRole: OrganisationMemberRole.MEMBER,
        type: OrganisationGroupType.INTERNAL_ORGANISATION,
      },
    },
    select: {
      id: true,
    },
  });

  const removedLinkCount = orgMemberInheritanceLinks.length;

  if (removedLinkCount > 0) {
    await prisma.teamGroup.deleteMany({
      where: {
        id: {
          in: orgMemberInheritanceLinks.map((link) => link.id),
        },
      },
    });
  }

  return {
    alreadyIsolated: removedLinkCount === 0,
    removedLinkCount,
    teamUrl: team.url,
  };
};
