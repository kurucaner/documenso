import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType } from '@prisma/client';

/**
 * Removes explicit INTERNAL_TEAM group memberships for an organisation member on one team.
 * Does not remove org-level inherited access (INTERNAL_ORGANISATION groups).
 */
export const removeTeamMemberInternal = async ({
  organisationMemberId,
  teamId,
}: {
  organisationMemberId: string;
  teamId: number;
}): Promise<void> => {
  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
    include: {
      organisation: {
        select: {
          id: true,
          ownerUserId: true,
        },
      },
      teamGroups: {
        where: {
          organisationGroup: {
            type: OrganisationGroupType.INTERNAL_TEAM,
          },
        },
        select: {
          organisationGroupId: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const organisationMember = await prisma.organisationMember.findFirst({
    where: {
      id: organisationMemberId,
      organisationId: team.organisation.id,
    },
    select: {
      userId: true,
    },
  });

  if (!organisationMember) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation member not found',
    });
  }

  const internalTeamGroupIds = team.teamGroups.map((group) => group.organisationGroupId);

  if (internalTeamGroupIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.envelope.updateMany({
      where: {
        teamId,
        userId: organisationMember.userId,
      },
      data: {
        userId: team.organisation.ownerUserId,
      },
    });

    await tx.organisationGroupMember.deleteMany({
      where: {
        groupId: {
          in: internalTeamGroupIds,
        },
        organisationMemberId,
      },
    });
  });
};
