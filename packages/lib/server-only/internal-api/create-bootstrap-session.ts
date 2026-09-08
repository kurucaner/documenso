import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { generateDatabaseId } from '../../universal/id';
import {
  BOOTSTRAP_SESSION_PATH,
  BOOTSTRAP_SESSION_TTL_MS,
  generateBootstrapSessionToken,
  hashBootstrapSessionToken,
} from './bootstrap-session-token';

export type CreateBootstrapSessionOptions = {
  userId: number;
};

export type CreateBootstrapSessionResult = {
  bootstrapPath: typeof BOOTSTRAP_SESSION_PATH;
  expiresAt: string;
  token: string;
};

export const createBootstrapSession = async ({
  userId,
}: CreateBootstrapSessionOptions): Promise<CreateBootstrapSessionResult> => {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      disabled: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
      statusCode: 404,
    });
  }

  if (user.disabled) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: 'Account disabled',
      statusCode: 403,
    });
  }

  if (user.twoFactorEnabled) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: 'Bootstrap sign-in is not available for accounts with two-factor authentication enabled',
      statusCode: 403,
    });
  }

  const token = generateBootstrapSessionToken();
  const tokenHash = hashBootstrapSessionToken(token);
  const expiresAt = new Date(Date.now() + BOOTSTRAP_SESSION_TTL_MS);

  await prisma.bootstrapSessionToken.create({
    data: {
      id: generateDatabaseId('bootstrap_session'),
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return {
    bootstrapPath: BOOTSTRAP_SESSION_PATH,
    expiresAt: expiresAt.toISOString(),
    token,
  };
};
