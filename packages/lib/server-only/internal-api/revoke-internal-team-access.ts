import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { removeOrganisationMemberInternal } from '@documenso/lib/server-only/organisation/remove-organisation-member-internal';
import { removeTeamMemberInternal } from '@documenso/lib/server-only/team/remove-team-member-internal';
import { prisma } from '@documenso/prisma';

import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type RevokeInternalTeamAccessOptions = {
  orgUrl: string;
  organisationMemberId: string;
  removeOrgMembership?: boolean;
  teamUrl: string;
};

export const revokeInternalTeamAccess = async ({
  orgUrl,
  organisationMemberId,
  removeOrgMembership = false,
  teamUrl,
}: RevokeInternalTeamAccessOptions): Promise<void> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const organisation = await prisma.organisation.findUnique({
    where: {
      url: orgUrl,
    },
    select: {
      id: true,
      teams: {
        where: {
          url: teamUrl,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const team = organisation.teams[0];

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  await removeTeamMemberInternal({
    organisationMemberId,
    teamId: team.id,
  });

  if (removeOrgMembership) {
    await removeOrganisationMemberInternal({
      organisationId: organisation.id,
      organisationMemberId,
    });
  }
};
