import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type CreateInternalTeamWebhookOptions = {
  teamUrl: string;
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  enabled: boolean;
  userId: number;
};

export const createInternalTeamWebhook = async ({
  teamUrl,
  webhookUrl,
  eventTriggers,
  secret,
  enabled,
  userId,
}: CreateInternalTeamWebhookOptions) => {
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

  return await prisma.webhook.create({
    data: {
      enabled,
      eventTriggers,
      secret,
      teamId: team.id,
      userId,
      webhookUrl,
    },
  });
};
