import { PROTECTED_TEAM_URLS } from '@documenso/lib/constants/teams';
import { prisma } from '@documenso/prisma';
import { ZTeamUrlSchema } from '@documenso/trpc/server/team-router/schema';
import slugify from '@sindresorhus/slugify';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { alphaid } from '../../universal/id';
import { createTeam } from '../team/create-team';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

const TEAM_URL_MIN_LENGTH = 3;
const TEAM_URL_MAX_LENGTH = 30;
const TEAM_URL_SUFFIX_LENGTH = 4;
const TEAM_URL_RESOLVE_MAX_ATTEMPTS = 12;

export type CreateInternalTeamOptions = {
  orgUrl: string;
  teamName: string;
  userId: number;
  teamUrl?: string;
};

export type CreateInternalTeamResult = {
  teamId: number;
  teamUrl: string;
  organisationId: string;
};

const normalizeSlugCandidate = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/[-_]{2,}/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');
};

const isValidTeamUrl = (value: string): boolean => {
  if (PROTECTED_TEAM_URLS.includes(value)) {
    return false;
  }

  return ZTeamUrlSchema.safeParse(value).success;
};

const buildBaseTeamUrlFromName = (teamName: string): string => {
  const slugified = normalizeSlugCandidate(slugify(teamName, { lowercase: true, separator: '_' }));

  if (slugified.length >= TEAM_URL_MIN_LENGTH) {
    return slugified.slice(0, TEAM_URL_MAX_LENGTH);
  }

  return `team_${alphaid(TEAM_URL_SUFFIX_LENGTH)}`.slice(0, TEAM_URL_MAX_LENGTH);
};

const teamUrlExists = async (teamUrl: string): Promise<boolean> => {
  const existing = await prisma.team.findUnique({
    where: {
      url: teamUrl,
    },
    select: {
      id: true,
    },
  });

  return existing != null;
};

export const resolveInternalTeamUrl = async ({
  teamName,
  teamUrl,
}: {
  teamName: string;
  teamUrl?: string;
}): Promise<string> => {
  if (teamUrl) {
    const normalized = teamUrl.trim().toLowerCase();

    if (!isValidTeamUrl(normalized)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Team URL is invalid',
      });
    }

    if (await teamUrlExists(normalized)) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'Team URL already exists',
      });
    }

    return normalized;
  }

  const base = buildBaseTeamUrlFromName(teamName);

  for (let attempt = 0; attempt < TEAM_URL_RESOLVE_MAX_ATTEMPTS; attempt++) {
    const suffix = attempt === 0 ? '' : `_${alphaid(TEAM_URL_SUFFIX_LENGTH)}`;
    const maxBaseLength = TEAM_URL_MAX_LENGTH - suffix.length;
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`;

    if (!isValidTeamUrl(candidate)) {
      continue;
    }

    if (!(await teamUrlExists(candidate))) {
      return candidate;
    }
  }

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: 'Unable to generate a unique team URL',
  });
};

export const createInternalTeam = async ({
  orgUrl,
  teamName,
  userId,
  teamUrl,
}: CreateInternalTeamOptions): Promise<CreateInternalTeamResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const organisation = await prisma.organisation.findUnique({
    where: {
      url: orgUrl,
    },
    select: {
      id: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const resolvedTeamUrl = await resolveInternalTeamUrl({
    teamName,
    teamUrl,
  });

  await createTeam({
    userId,
    teamName,
    teamUrl: resolvedTeamUrl,
    organisationId: organisation.id,
    inheritMembers: true,
  });

  const team = await prisma.team.findUnique({
    where: {
      url: resolvedTeamUrl,
    },
    select: {
      id: true,
      url: true,
      organisationId: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to resolve team after creation',
    });
  }

  return {
    teamId: team.id,
    teamUrl: team.url,
    organisationId: team.organisationId,
  };
};
