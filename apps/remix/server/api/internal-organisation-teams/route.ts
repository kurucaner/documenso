import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createInternalTeam } from '@documenso/lib/server-only/internal-api/create-internal-team';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalTeamRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { ZNameSchema } from '@documenso/lib/types/name';
import { ZTeamUrlSchema } from '@documenso/trpc/server/team-router/schema';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalTeamRateLimitMiddleware = createRateLimitMiddleware(internalTeamRateLimit);

const ZCreateInternalTeamRequestSchema = z.object({
  teamName: ZNameSchema,
  userId: z.number().int().positive(),
  teamUrl: ZTeamUrlSchema.optional(),
});

export const internalOrganisationTeamsRoute = new Hono<HonoEnv>()
  .use('*', internalTeamRateLimitMiddleware)
  .post('/', sValidator('json', ZCreateInternalTeamRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const orgUrl = c.req.param('orgUrl');
    const body = c.req.valid('json');

    if (!orgUrl) {
      throw new HTTPException(400, {
        message: 'Organisation URL is required',
      });
    }

    try {
      const result = await createInternalTeam({
        orgUrl,
        teamName: body.teamName,
        userId: body.userId,
        teamUrl: body.teamUrl,
      });

      return c.json(result, 201);
    } catch (error) {
      const appError = AppError.parseError(error);

      if (appError.code === AppErrorCode.NOT_FOUND) {
        throw new HTTPException(404, {
          message: appError.message ?? 'Organisation not found',
        });
      }

      if (appError.code === AppErrorCode.ALREADY_EXISTS) {
        throw new HTTPException(409, {
          message: appError.message ?? 'Team URL already exists',
        });
      }

      if (appError.code === AppErrorCode.NOT_SETUP && appError.statusCode === 503) {
        throw new HTTPException(503, {
          message: appError.message,
        });
      }

      if (appError.code === AppErrorCode.INVALID_REQUEST || appError.code === AppErrorCode.LIMIT_EXCEEDED) {
        throw new HTTPException(400, {
          message: appError.message,
        });
      }

      throw error;
    }
  });
