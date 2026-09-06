import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type ListInternalUserOrganisationsOptions = {
  userId: number;
};

export type ListInternalUserOrganisation = {
  name: string;
  orgUrl: string;
};

export type ListInternalUserOrganisationsResult = {
  organisations: ListInternalUserOrganisation[];
};

export const listInternalUserOrganisations = async ({
  userId,
}: ListInternalUserOrganisationsOptions): Promise<ListInternalUserOrganisationsResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  const organisations = await prisma.organisation.findMany({
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      name: true,
      url: true,
    },
    where: {
      ownerUserId: userId,
    },
  });

  return {
    organisations: organisations.map((organisation) => ({
      name: organisation.name,
      orgUrl: organisation.url,
    })),
  };
};
