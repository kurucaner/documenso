import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createBootstrapSession } from '@documenso/lib/server-only/internal-api/create-bootstrap-session';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalUserRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalUserRateLimitMiddleware = createRateLimitMiddleware(internalUserRateLimit);

function parseUserIdParam(userIdParam: string | undefined): number {
  const userId = Number(userIdParam);

  if (!userIdParam || !Number.isInteger(userId) || userId <= 0) {
    throw new HTTPException(400, {
      message: 'userId must be a positive integer',
    });
  }

  return userId;
}

function mapBootstrapSessionRouteError(error: unknown): never {
  const appError = AppError.parseError(error);

  if (appError.code === AppErrorCode.NOT_FOUND) {
    throw new HTTPException(404, {
      message: appError.message ?? 'User not found',
    });
  }

  if (appError.code === AppErrorCode.FORBIDDEN) {
    throw new HTTPException(403, {
      message: appError.message,
    });
  }

  if (appError.code === AppErrorCode.NOT_SETUP && appError.statusCode === 503) {
    throw new HTTPException(503, {
      message: appError.message,
    });
  }

  throw error;
}

export const internalUserBootstrapSessionRoute = new Hono<HonoEnv>().post(
  '/',
  internalUserRateLimitMiddleware,
  async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const userId = parseUserIdParam(c.req.param('userId'));

    try {
      const result = await createBootstrapSession({ userId });

      return c.json(result, 201);
    } catch (error) {
      mapBootstrapSessionRouteError(error);
    }
  },
);
