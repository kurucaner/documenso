import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { normalizeSignupInviteEmail } from '../signup-invite/get-signup-invite-by-token';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type GetInternalUserByEmailOptions = {
  email: string;
};

export type GetInternalUserByEmailResult = {
  email: string;
  name: string;
  userId: number;
};

export const getInternalUserByEmail = async ({
  email,
}: GetInternalUserByEmailOptions): Promise<GetInternalUserByEmailResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const normalizedEmail = normalizeSignupInviteEmail(email);

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
    },
    select: {
      email: true,
      id: true,
      name: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  return {
    email: user.email,
    name: user.name?.trim() || user.email,
    userId: user.id,
  };
};
