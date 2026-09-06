import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

/**
 * Throws if self-service account deletion is disabled for the supplied user.
 */
export const assertAccountDeletionAllowed = (user: { accountDeletionDisabled: boolean }): void => {
  if (user.accountDeletionDisabled) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: 'Account deletion is disabled for this account',
      statusCode: 403,
    });
  }
};

export type AssertAccountDeletionAllowedByIdOptions = {
  userId: number;
};

/**
 * Re-queries the user so a freshly-updated flag cannot be bypassed via a stale session.
 */
export const assertAccountDeletionAllowedById = async ({
  userId,
}: AssertAccountDeletionAllowedByIdOptions): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { accountDeletionDisabled: true },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
      statusCode: 404,
    });
  }

  assertAccountDeletionAllowed(user);
};
