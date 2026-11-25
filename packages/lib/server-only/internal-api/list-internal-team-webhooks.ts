import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type ListInternalTeamWebhooksOptions = {
  teamUrl: string;
};

export const listInternalTeamWebhooks = async ({ teamUrl }: ListInternalTeamWebhooksOptions) => {
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

  return await prisma.webhook.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    where: {
      teamId: team.id,
    },
  });
};
