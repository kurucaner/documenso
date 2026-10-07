import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type GetInternalTeamInheritsOrgMembersOptions = {
  orgUrl: string;
  teamUrl: string;
};

export type GetInternalTeamInheritsOrgMembersResult = {
  inheritsOrgMembers: boolean;
  teamUrl: string;
};

export const getInternalTeamInheritsOrgMembers = async ({
  orgUrl,
  teamUrl,
}: GetInternalTeamInheritsOrgMembersOptions): Promise<GetInternalTeamInheritsOrgMembersResult> => {
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

  const orgMemberInheritanceLink = await prisma.teamGroup.findFirst({
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

  return {
    inheritsOrgMembers: orgMemberInheritanceLink != null,
    teamUrl: team.url,
  };
};
