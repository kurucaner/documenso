import { prisma } from '@documenso/prisma';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ApiTokenExpiration } from '../../types/api-token-expiration';
import { buildTeamWhereQuery } from '../../utils/teams';
import { createApiTokenRecord } from '../public-api/create-api-token-record';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type CreateInternalApiTokenOptions = {
  teamUrl: string;
  tokenName: string;
  expirationDate?: ApiTokenExpiration;
  userId?: number;
};

export type CreateInternalApiTokenResult = {
  id: number;
  token: string;
  teamId: number;
  teamUrl: string;
  expiresAt: Date | null;
};

export const createInternalApiToken = async ({
  teamUrl,
  tokenName,
  expirationDate = null,
  userId,
}: CreateInternalApiTokenOptions): Promise<CreateInternalApiTokenResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const team = await prisma.team.findUnique({
    where: {
      url: teamUrl,
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

  if (userId !== undefined) {
    const memberTeam = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId: team.id,
        userId,
      }),
      select: {
        id: true,
      },
    });

    if (!memberTeam) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'User is not a member of this team',
      });
    }
  }

  const { id, token, expiresAt } = await createApiTokenRecord({
    teamId: team.id,
    tokenName,
    expiresIn: expirationDate,
    userId: userId ?? null,
  });

  return {
    id,
    token,
    teamId: team.id,
    teamUrl: team.url,
    expiresAt,
  };
};
