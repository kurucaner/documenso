import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type DeleteInternalTeamWebhookOptions = {
  teamUrl: string;
  webhookId: string;
};

export const deleteInternalTeamWebhook = async ({
  teamUrl,
  webhookId,
}: DeleteInternalTeamWebhookOptions): Promise<void> => {
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

  const existingWebhook = await prisma.webhook.findFirst({
    select: {
      id: true,
    },
    where: {
      id: webhookId,
      teamId: team.id,
    },
  });

  if (!existingWebhook) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Webhook not found',
    });
  }

  await prisma.webhook.delete({
    where: {
      id: webhookId,
      teamId: team.id,
    },
  });
};
