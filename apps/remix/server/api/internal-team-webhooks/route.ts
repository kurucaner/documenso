import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createInternalTeamWebhook } from '@documenso/lib/server-only/internal-api/create-internal-team-webhook';
import { deleteInternalTeamWebhook } from '@documenso/lib/server-only/internal-api/delete-internal-team-webhook';
import { listInternalTeamWebhooks } from '@documenso/lib/server-only/internal-api/list-internal-team-webhooks';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalApiTokenRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { ZCreateWebhookRequestSchema } from '@documenso/trpc/server/webhook-router/schema';
import { ZWebhookResponseSchema } from '@documenso/trpc/server/webhook-router/webhook.types';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalTeamWebhookRateLimitMiddleware = createRateLimitMiddleware(internalApiTokenRateLimit);

const ZCreateInternalTeamWebhookRequestSchema = ZCreateWebhookRequestSchema.extend({
  userId: z.number().int().positive(),
});

const ZListInternalTeamWebhooksResponseSchema = z.array(ZWebhookResponseSchema);

const mapAppErrorToHttp = (error: unknown): never => {
  const appError = AppError.parseError(error);

  if (appError.code === AppErrorCode.NOT_FOUND) {
    throw new HTTPException(404, {
      message: appError.message ?? 'Not found',
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
};

export const internalTeamWebhooksRoute = new Hono<HonoEnv>()
  .use('*', internalTeamWebhookRateLimitMiddleware)
  .post('/', sValidator('json', ZCreateInternalTeamWebhookRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const teamUrl = c.req.param('teamUrl');
    const body = c.req.valid('json');

    if (!teamUrl) {
      throw new HTTPException(400, {
        message: 'Team URL is required',
      });
    }

    try {
      const webhook = await createInternalTeamWebhook({
        enabled: body.enabled,
        eventTriggers: body.eventTriggers,
        secret: body.secret,
        teamUrl,
        userId: body.userId,
        webhookUrl: body.webhookUrl,
      });

      return c.json(webhook, 201);
    } catch (error) {
      return mapAppErrorToHttp(error);
    }
  })
  .get('/', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const teamUrl = c.req.param('teamUrl');

    if (!teamUrl) {
      throw new HTTPException(400, {
        message: 'Team URL is required',
      });
    }

    try {
      const webhooks = await listInternalTeamWebhooks({ teamUrl });

      return c.json(ZListInternalTeamWebhooksResponseSchema.parse(webhooks));
    } catch (error) {
      return mapAppErrorToHttp(error);
    }
  })
  .delete('/:webhookId', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const teamUrl = c.req.param('teamUrl');
    const webhookId = c.req.param('webhookId');

    if (!teamUrl) {
      throw new HTTPException(400, {
        message: 'Team URL is required',
      });
    }

    if (!webhookId?.trim()) {
      throw new HTTPException(400, {
        message: 'Webhook ID is required',
      });
    }

    try {
      await deleteInternalTeamWebhook({
        teamUrl,
        webhookId,
      });

      return c.body(null, 204);
    } catch (error) {
      return mapAppErrorToHttp(error);
    }
  });
