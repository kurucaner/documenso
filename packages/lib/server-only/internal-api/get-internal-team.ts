import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type GetInternalTeamOptions = {
  teamReference: number | string;
};

export type GetInternalTeamResult = {
  organisationId: string;
  teamId: number;
  teamName: string;
  teamUrl: string;
};

const parseTeamReference = (teamReference: number | string): { teamId?: number; teamUrl?: string } => {
  if (typeof teamReference === 'number') {
    if (!Number.isInteger(teamReference) || teamReference <= 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Team reference must be a positive integer or URL slug',
      });
    }

    return { teamId: teamReference };
  }

  const trimmed = teamReference.trim();

  if (trimmed.length === 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Team reference must be a positive integer or URL slug',
    });
  }

  const parsedId = Number(trimmed);

  if (Number.isInteger(parsedId) && parsedId > 0 && String(parsedId) === trimmed) {
    return { teamId: parsedId };
  }

  return { teamUrl: trimmed.toLowerCase() };
};

export const getInternalTeam = async ({ teamReference }: GetInternalTeamOptions): Promise<GetInternalTeamResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const parsedReference = parseTeamReference(teamReference);

  const team = await prisma.team.findFirst({
    where: {
      ...(parsedReference.teamId != null ? { id: parsedReference.teamId } : {}),
      ...(parsedReference.teamUrl != null ? { url: parsedReference.teamUrl } : {}),
    },
    select: {
      id: true,
      name: true,
      organisationId: true,
      url: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  return {
    organisationId: team.organisationId,
    teamId: team.id,
    teamName: team.name,
    teamUrl: team.url,
  };
};
