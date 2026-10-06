import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';

/**
 * Removes an organisation member without session auth (PropertyOS internal API).
 * Refuses to remove the organisation owner.
 */
export const removeOrganisationMemberInternal = async ({
  organisationId,
  organisationMemberId,
}: {
  organisationId: string;
  organisationMemberId: string;
}): Promise<void> => {
  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    select: {
      id: true,
      ownerUserId: true,
      teams: {
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

  const member = await prisma.organisationMember.findFirst({
    where: {
      id: organisationMemberId,
      organisationId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!member) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation member not found',
    });
  }

  if (member.userId === organisation.ownerUserId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Cannot remove the organisation owner',
    });
  }

  const teamIds = organisation.teams.map((team) => team.id);

  await prisma.$transaction(async (tx) => {
    if (teamIds.length > 0) {
      await tx.envelope.updateMany({
        where: {
          teamId: {
            in: teamIds,
          },
          userId: member.userId,
        },
        data: {
          userId: organisation.ownerUserId,
        },
      });
    }

    await tx.organisationMember.delete({
      where: {
        id: organisationMemberId,
      },
    });
  });

  await jobs.triggerJob({
    name: 'internal.sync-organisation-seats',
    payload: { organisationId },
  });
};
