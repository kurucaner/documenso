import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isInternalSecretConfigured } from '@documenso/lib/server-only/internal-api/is-internal-secret-configured';
import { verifyInternalSecret } from '@documenso/lib/server-only/internal-api/verify-internal-secret';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { signupInviteRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { createSignupInvite } from '@documenso/lib/server-only/signup-invite/create-signup-invite';
import { getSignupInviteByToken } from '@documenso/lib/server-only/signup-invite/get-signup-invite-by-token';
import { revokeSignupInvite } from '@documenso/lib/server-only/signup-invite/revoke-signup-invite';
import { ZNameSchema } from '@documenso/lib/types/name';
import { zEmail } from '@documenso/lib/utils/zod';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { HonoEnv } from '../../router';

const signupInviteRateLimitMiddleware = createRateLimitMiddleware(signupInviteRateLimit);

const ZCreateSignupInviteRequestSchema = z.object({
  email: zEmail(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
  organisationName: ZNameSchema.optional(),
  teamName: ZNameSchema.optional(),
});

const requireInternalSecret = (authorizationHeader: string | null | undefined) => {
  if (!isInternalSecretConfigured()) {
    throw new HTTPException(503, {
      message: 'Internal API is not configured',
    });
  }

  if (!verifyInternalSecret(authorizationHeader)) {
    throw new HTTPException(401, {
      message: 'Unauthorized',
    });
  }
};

export const signupInvitesRoute = new Hono<HonoEnv>()
  .use('*', signupInviteRateLimitMiddleware)
  .post('/', sValidator('json', ZCreateSignupInviteRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const body = c.req.valid('json');

    const invite = await createSignupInvite({
      email: body.email,
      expiresInDays: body.expiresInDays,
      organisationName: body.organisationName,
      teamName: body.teamName,
    });

    return c.json(invite, 201);
  })
  .get('/:token', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const { token } = c.req.param();

    const invite = await getSignupInviteByToken(token);

    if (!invite) {
      throw new HTTPException(404, {
        message: 'Signup invite not found',
      });
    }

    return c.json({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
      status: invite.status,
      organisationName: invite.organisationName,
      teamName: invite.teamName,
      createdAt: invite.createdAt,
      acceptedAt: invite.acceptedAt,
    });
  })
  .delete('/:token', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const { token } = c.req.param();

    try {
      const invite = await revokeSignupInvite(token);

      return c.json({
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        status: invite.status,
        organisationName: invite.organisationName,
        teamName: invite.teamName,
        createdAt: invite.createdAt,
        acceptedAt: invite.acceptedAt,
      });
    } catch (error) {
      const appError = AppError.parseError(error);

      if (appError.code === AppErrorCode.NOT_FOUND) {
        throw new HTTPException(404, {
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
