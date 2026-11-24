import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export const MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE =
  'This organisation is managed by an integration. Change workspace settings in the application that connected Documenso.';

export type ManagedOrganisationDashboardWriteGuardInput = {
  isManaged: boolean;
};

/**
 * Throws when dashboard (authenticated) mutations must not change integration-managed org structure.
 */
export const assertManagedOrganisationDashboardWriteAllowed = (
  input: ManagedOrganisationDashboardWriteGuardInput,
): void => {
  if (input.isManaged) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
      statusCode: 403,
    });
  }
};

export type AssertManagedOrganisationDashboardWriteAllowedByIdOptions = {
  organisationId: string;
};

export const assertManagedOrganisationDashboardWriteAllowedById = async ({
  organisationId,
}: AssertManagedOrganisationDashboardWriteAllowedByIdOptions): Promise<void> => {
  const organisation = await prisma.organisation.findFirst({
    select: {
      isManaged: true,
    },
    where: { id: organisationId },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
      statusCode: 404,
    });
  }

  assertManagedOrganisationDashboardWriteAllowed({
    isManaged: organisation.isManaged,
  });
};

export type ResolveOrganisationIdByTeamIdOptions = {
  teamId: number;
};

/**
 * Loads the parent organisation id for dashboard write guards on team-scoped tRPC routes.
 */
export const resolveOrganisationIdByTeamId = async ({
  teamId,
}: ResolveOrganisationIdByTeamIdOptions): Promise<string> => {
  const team = await prisma.team.findFirst({
    select: {
      organisationId: true,
    },
    where: { id: teamId },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
      statusCode: 404,
    });
  }

  return team.organisationId;
};

export type AssertManagedOrganisationDashboardWriteAllowedByTeamIdOptions = {
  teamId: number;
};

export const assertManagedOrganisationDashboardWriteAllowedByTeamId = async ({
  teamId,
}: AssertManagedOrganisationDashboardWriteAllowedByTeamIdOptions): Promise<void> => {
  const team = await prisma.team.findFirst({
    select: {
      organisation: {
        select: {
          isManaged: true,
        },
      },
    },
    where: { id: teamId },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
      statusCode: 404,
    });
  }

  assertManagedOrganisationDashboardWriteAllowed({
    isManaged: team.organisation.isManaged,
  });
};
