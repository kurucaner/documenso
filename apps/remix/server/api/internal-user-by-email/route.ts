import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getInternalUserByEmail } from '@documenso/lib/server-only/internal-api/get-internal-user-by-email';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalUserRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { zEmail } from '@documenso/lib/utils/zod';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalUserRateLimitMiddleware = createRateLimitMiddleware(internalUserRateLimit);

export const internalUserByEmailRoute = new Hono<HonoEnv>()
  .use('*', internalUserRateLimitMiddleware)
  .get('/', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const email = c.req.query('email')?.trim();

    if (!email) {
      throw new HTTPException(400, {
        message: 'email query parameter is required',
      });
    }

    const parsedEmail = zEmail().safeParse(email);

    if (!parsedEmail.success) {
      throw new HTTPException(400, {
        message: 'email query parameter is invalid',
      });
    }

    try {
      const result = await getInternalUserByEmail({
        email: parsedEmail.data,
      });

      return c.json(result, 200);
    } catch (error) {
      const appError = AppError.parseError(error);

      if (appError.code === AppErrorCode.NOT_FOUND) {
        throw new HTTPException(404, {
          message: appError.message ?? 'User not found',
        });
      }

      if (appError.code === AppErrorCode.NOT_SETUP && appError.statusCode === 503) {
        throw new HTTPException(503, {
          message: appError.message,
        });
      }

      throw error;
    }
  });
