import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getInternalTeam } from '@documenso/lib/server-only/internal-api/get-internal-team';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalTeamReadRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalTeamReadRateLimitMiddleware = createRateLimitMiddleware(internalTeamReadRateLimit);

export const internalTeamRoute = new Hono<HonoEnv>()
  .use('*', internalTeamReadRateLimitMiddleware)
  .get('/', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const teamReference = c.req.param('teamReference');

    if (!teamReference) {
      throw new HTTPException(400, {
        message: 'Team reference is required',
      });
    }

    try {
      const result = await getInternalTeam({
        teamReference,
      });

      return c.json(result, 200);
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
