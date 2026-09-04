import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { createApiTokenRecord } from './create-api-token-record';

type CreateApiTokenInput = {
  userId: number;
  teamId: number;
  tokenName: string;
  expiresIn: string | null;
};

export const createApiToken = async ({ userId, teamId, tokenName, expiresIn }: CreateApiTokenInput) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to create a token for this team',
    });
  }

  const { id, token } = await createApiTokenRecord({
    teamId,
    tokenName,
    expiresIn,
    userId,
  });

  return {
    id,
    token,
  };
};
