import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { hashBootstrapSessionToken } from './bootstrap-session-token';

export type ConsumeBootstrapSessionOptions = {
  token: string;
};

export type ConsumeBootstrapSessionResult = {
  tokenId: string;
  userId: number;
};

export const consumeBootstrapSession = async ({
  token,
}: ConsumeBootstrapSessionOptions): Promise<ConsumeBootstrapSessionResult> => {
  const tokenHash = hashBootstrapSessionToken(token);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const record = await tx.bootstrapSessionToken.findUnique({
      where: { tokenHash },
      select: {
        consumedAt: true,
        expiresAt: true,
        id: true,
        userId: true,
      },
    });

    if (!record) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid bootstrap session token',
        statusCode: 400,
      });
    }

    if (record.consumedAt) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Bootstrap session token already used',
        statusCode: 400,
      });
    }

    if (record.expiresAt <= now) {
      throw new AppError(AppErrorCode.EXPIRED_CODE, {
        message: 'Bootstrap session token expired',
        statusCode: 400,
      });
    }

    const user = await tx.user.findFirst({
      where: { id: record.userId },
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

    const updated = await tx.bootstrapSessionToken.updateMany({
      where: {
        consumedAt: null,
        expiresAt: { gt: now },
        id: record.id,
      },
      data: {
        consumedAt: now,
      },
    });

    if (updated.count !== 1) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Bootstrap session token already used',
        statusCode: 400,
      });
    }

    return {
      tokenId: record.id,
      userId: record.userId,
    };
  });
};
