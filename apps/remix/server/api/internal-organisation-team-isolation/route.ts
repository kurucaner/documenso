import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { applyInternalTeamIsolationRepair } from '@documenso/lib/server-only/internal-api/apply-internal-team-isolation-repair';
import { getInternalTeamInheritsOrgMembers } from '@documenso/lib/server-only/internal-api/get-internal-team-inherits-org-members';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalTeamRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalTeamRateLimitMiddleware = createRateLimitMiddleware(internalTeamRateLimit);

const mapInternalTeamIsolationError = (error: unknown): never => {
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

export const internalOrganisationTeamIsolationRoute = new Hono<HonoEnv>()
  .use('*', internalTeamRateLimitMiddleware)
  .get('/inherits-org-members', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const orgUrl = c.req.param('orgUrl');
    const teamUrl = c.req.param('teamUrl');

    if (!orgUrl || !teamUrl) {
      throw new HTTPException(400, {
        message: 'Organisation URL and team URL are required',
      });
    }

    try {
      const result = await getInternalTeamInheritsOrgMembers({
        orgUrl,
        teamUrl,
      });

      return c.json(result, 200);
    } catch (error) {
      mapInternalTeamIsolationError(error);
    }
  })
  .post('/apply-isolation-repair', async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const orgUrl = c.req.param('orgUrl');
    const teamUrl = c.req.param('teamUrl');

    if (!orgUrl || !teamUrl) {
      throw new HTTPException(400, {
        message: 'Organisation URL and team URL are required',
      });
    }

    try {
      const result = await applyInternalTeamIsolationRepair({
        orgUrl,
        teamUrl,
      });

      return c.json(result, 200);
    } catch (error) {
      mapInternalTeamIsolationError(error);
    }
  });
