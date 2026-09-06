import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createInternalOrganisationForUser } from '@documenso/lib/server-only/internal-api/create-internal-organisation-for-user';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalUserRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { ZNameSchema } from '@documenso/lib/types/name';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalUserRateLimitMiddleware = createRateLimitMiddleware(internalUserRateLimit);

const ZCreateInternalOrganisationForUserRequestSchema = z.object({
  organisationName: ZNameSchema,
  orgUrl: z.string().trim().min(1).optional(),
  teamName: ZNameSchema.optional(),
});

export const internalUserOrganisationsRoute = new Hono<HonoEnv>()
  .use('*', internalUserRateLimitMiddleware)
  .post('/', sValidator('json', ZCreateInternalOrganisationForUserRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const userIdParam = c.req.param('userId');
    const userId = Number(userIdParam);

    if (!userIdParam || !Number.isInteger(userId) || userId <= 0) {
      throw new HTTPException(400, {
        message: 'userId must be a positive integer',
      });
    }

    const body = c.req.valid('json');

    try {
      const result = await createInternalOrganisationForUser({
        organisationName: body.organisationName,
        orgUrl: body.orgUrl,
        teamName: body.teamName,
        userId,
      });

      return c.json(result, 201);
    } catch (error) {
      const appError = AppError.parseError(error);

      if (appError.code === AppErrorCode.NOT_FOUND) {
        throw new HTTPException(404, {
          message: appError.message ?? 'User not found',
        });
      }

      if (appError.code === AppErrorCode.ALREADY_EXISTS) {
        throw new HTTPException(409, {
          message: appError.message ?? 'Organisation URL already exists',
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
