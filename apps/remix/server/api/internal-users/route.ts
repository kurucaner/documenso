import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { provisionInternalUser } from '@documenso/lib/server-only/internal-api/provision-internal-user';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalUserRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { ZNameSchema } from '@documenso/lib/types/name';
import { zEmail } from '@documenso/lib/utils/zod';
import { ZPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalUserRateLimitMiddleware = createRateLimitMiddleware(internalUserRateLimit);

const ZProvisionInternalUserRequestSchema = z
  .object({
    name: ZNameSchema,
    email: zEmail(),
    password: ZPasswordSchema,
    signature: z.string().min(1),
    organisationName: ZNameSchema.optional(),
    teamName: ZNameSchema.optional(),
  })
  .refine(
    (data) => {
      const { name, email, password } = data;

      return !password.includes(name) && !password.includes(email.split('@')[0]);
    },
    {
      message: 'Password should not be common or based on personal information',
      path: ['password'],
    },
  );

export const internalUsersRoute = new Hono<HonoEnv>()
  .use('*', internalUserRateLimitMiddleware)
  .post('/', sValidator('json', ZProvisionInternalUserRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const body = c.req.valid('json');

    try {
      const result = await provisionInternalUser(body);

      return c.json(result, 201);
    } catch (error) {
      const appError = AppError.parseError(error);

      if (appError.code === AppErrorCode.ALREADY_EXISTS) {
        throw new HTTPException(409, {
          message: appError.message ?? 'User already exists',
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
