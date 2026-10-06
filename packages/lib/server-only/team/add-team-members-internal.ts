import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

export type AddTeamMembersInternalMember = {
  organisationMemberId: string;
  teamRole: TeamMemberRole;
};

/**
 * Adds organisation members to a team internal role groups without session auth.
 * Idempotent when the same (organisationMemberId, teamRole) is already assigned.
 */
export const addTeamMembersInternal = async ({
  teamId,
  membersToCreate,
}: {
  teamId: number;
  membersToCreate: AddTeamMembersInternalMember[];
}): Promise<void> => {
  if (membersToCreate.length === 0) {
    return;
  }

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
    include: {
      organisation: {
        include: {
          members: {
            select: {
              id: true,
            },
          },
        },
      },
      teamGroups: {
        where: {
          organisationGroup: {
            type: OrganisationGroupType.INTERNAL_TEAM,
          },
        },
        include: {
          organisationGroup: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const isMembersPartOfOrganisation = membersToCreate.every((member) =>
    team.organisation.members.some(({ id }) => id === member.organisationMemberId),
  );

  if (!isMembersPartOfOrganisation) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Some member IDs do not exist',
    });
  }

  const teamMemberGroup = team.teamGroups.find(
    (group) =>
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
      group.teamId === teamId &&
      group.teamRole === TeamMemberRole.MEMBER,
  );

  const teamManagerGroup = team.teamGroups.find(
    (group) =>
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
      group.teamId === teamId &&
      group.teamRole === TeamMemberRole.MANAGER,
  );

  const teamAdminGroup = team.teamGroups.find(
    (group) =>
      group.organisationGroup.type === OrganisationGroupType.INTERNAL_TEAM &&
      group.teamId === teamId &&
      group.teamRole === TeamMemberRole.ADMIN,
  );

  if (!teamMemberGroup || !teamManagerGroup || !teamAdminGroup) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team groups not found.',
    });
  }

  const teamRoleGroupId = (role: TeamMemberRole) =>
    match(role)
      .with(TeamMemberRole.MEMBER, () => teamMemberGroup.organisationGroupId)
      .with(TeamMemberRole.MANAGER, () => teamManagerGroup.organisationGroupId)
      .with(TeamMemberRole.ADMIN, () => teamAdminGroup.organisationGroupId)
      .exhaustive();

  const existingTeamGroupMemberships = await prisma.organisationGroupMember.findMany({
    where: {
      organisationMemberId: {
        in: membersToCreate.map((member) => member.organisationMemberId),
      },
      groupId: {
        in: [
          teamMemberGroup.organisationGroupId,
          teamManagerGroup.organisationGroupId,
          teamAdminGroup.organisationGroupId,
        ],
      },
    },
    select: { organisationMemberId: true, groupId: true },
  });

  const existingPairs = new Set(
    existingTeamGroupMemberships.map(({ organisationMemberId, groupId }) => `${organisationMemberId}:${groupId}`),
  );

  const filteredMembersToCreate = membersToCreate.filter(
    (member) => !existingPairs.has(`${member.organisationMemberId}:${teamRoleGroupId(member.teamRole)}`),
  );

  if (filteredMembersToCreate.length === 0) {
    return;
  }

  await prisma.organisationGroupMember.createMany({
    data: filteredMembersToCreate.map((member) => ({
      id: generateDatabaseId('group_member'),
      organisationMemberId: member.organisationMemberId,
      groupId: teamRoleGroupId(member.teamRole),
    })),
  });
};
