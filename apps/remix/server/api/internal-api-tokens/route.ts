import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createInternalApiToken } from '@documenso/lib/server-only/internal-api/create-internal-api-token';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalApiTokenRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { ZApiTokenExpirationSchema } from '@documenso/lib/types/api-token-expiration';
import { ZNameSchema } from '@documenso/lib/types/name';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalApiTokenRateLimitMiddleware = createRateLimitMiddleware(internalApiTokenRateLimit);

const ZCreateInternalApiTokenRequestSchema = z.object({
  tokenName: ZNameSchema,
  expirationDate: ZApiTokenExpirationSchema.optional(),
  userId: z.number().int().positive().optional(),
});

export const internalApiTokensRoute = new Hono<HonoEnv>()
  .use('*', internalApiTokenRateLimitMiddleware)
  .post('/', sValidator('json', ZCreateInternalApiTokenRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const teamUrl = c.req.param('teamUrl');
    const body = c.req.valid('json');

    if (!teamUrl) {
      throw new HTTPException(400, {
        message: 'Team URL is required',
      });
    }

    try {
      const result = await createInternalApiToken({
        teamUrl,
        tokenName: body.tokenName,
        expirationDate: body.expirationDate,
        userId: body.userId,
      });

      return c.json(result, 201);
    } catch (error) {
      const appError = AppError.parseError(error);

      if (appError.code === AppErrorCode.NOT_FOUND) {
        throw new HTTPException(404, {
          message: appError.message ?? 'Team not found',
        });
      }

      if (appError.code === AppErrorCode.NOT_SETUP && appError.statusCode === 503) {
        throw new HTTPException(503, {
          message: appError.message,
        });
      }

      if (appError.code === AppErrorCode.INVALID_REQUEST) {
        throw new HTTPException(400, {
          message: appError.message,
        });
      }

      throw error;
    }
  });
