import { prisma } from '@documenso/prisma';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type DeleteInternalApiTokenOptions = {
  teamUrl: string;
  tokenId: number;
};

export const deleteInternalApiToken = async ({ teamUrl, tokenId }: DeleteInternalApiTokenOptions): Promise<void> => {
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
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const existingToken = await prisma.apiToken.findFirst({
    where: {
      id: tokenId,
      teamId: team.id,
    },
    select: {
      id: true,
    },
  });

  if (!existingToken) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'API token not found',
    });
  }

  await prisma.apiToken.delete({
    where: {
      id: tokenId,
      teamId: team.id,
    },
  });
};
