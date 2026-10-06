import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { revokeInternalTeamAccess } from '@documenso/lib/server-only/internal-api/revoke-internal-team-access';
import { upsertInternalTeamAccess } from '@documenso/lib/server-only/internal-api/upsert-internal-team-access';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { internalTeamRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { ZNameSchema } from '@documenso/lib/types/name';
import { zEmail } from '@documenso/lib/utils/zod';
import { ZTeamUrlSchema } from '@documenso/trpc/server/team-router/schema';
import { sValidator } from '@hono/standard-validator';
import { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireInternalSecret } from '../../internal-api/require-internal-secret';
import type { HonoEnv } from '../../router';

const internalTeamRateLimitMiddleware = createRateLimitMiddleware(internalTeamRateLimit);

const ZOrganisationMemberRole = z.nativeEnum(OrganisationMemberRole);
const ZTeamMemberRole = z.nativeEnum(TeamMemberRole);

const ZUpsertInternalTeamAccessRequestSchema = z.object({
  disableAccountDeletion: z.boolean().optional(),
  email: zEmail(),
  name: ZNameSchema.optional(),
  organisationMemberRole: ZOrganisationMemberRole,
  provisionIfMissing: z.boolean().optional(),
  teamMemberRole: ZTeamMemberRole,
  teamUrl: ZTeamUrlSchema,
});

const ZRevokeInternalTeamAccessRequestSchema = z.object({
  organisationMemberId: z.string().min(1),
  removeOrgMembership: z.boolean().optional(),
  teamUrl: ZTeamUrlSchema,
});

const mapInternalTeamAccessError = (error: unknown): never => {
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

  if (appError.code === AppErrorCode.INVALID_BODY || appError.code === AppErrorCode.INVALID_REQUEST) {
    throw new HTTPException(400, {
      message: appError.message,
    });
  }

  if (appError.code === AppErrorCode.UNAUTHORIZED) {
    throw new HTTPException(403, {
      message: appError.message ?? 'Forbidden',
    });
  }

  if (appError.code === 'SUBSCRIPTION_INACTIVE') {
    throw new HTTPException(400, {
      message: appError.message,
    });
  }

  throw error;
};

export const internalOrganisationTeamAccessRoute = new Hono<HonoEnv>()
  .use('*', internalTeamRateLimitMiddleware)
  .put('/', sValidator('json', ZUpsertInternalTeamAccessRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const orgUrl = c.req.param('orgUrl');
    const body = c.req.valid('json');

    if (!orgUrl) {
      throw new HTTPException(400, {
        message: 'Organisation URL is required',
      });
    }

    try {
      const result = await upsertInternalTeamAccess({
        disableAccountDeletion: body.disableAccountDeletion,
        email: body.email,
        name: body.name,
        orgUrl,
        organisationMemberRole: body.organisationMemberRole,
        provisionIfMissing: body.provisionIfMissing,
        teamMemberRole: body.teamMemberRole,
        teamUrl: body.teamUrl,
      });

      return c.json(result, 200);
    } catch (error) {
      mapInternalTeamAccessError(error);
    }
  })
  .patch('/', sValidator('json', ZUpsertInternalTeamAccessRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const orgUrl = c.req.param('orgUrl');
    const body = c.req.valid('json');

    if (!orgUrl) {
      throw new HTTPException(400, {
        message: 'Organisation URL is required',
      });
    }

    try {
      const result = await upsertInternalTeamAccess({
        disableAccountDeletion: body.disableAccountDeletion,
        email: body.email,
        name: body.name,
        orgUrl,
        organisationMemberRole: body.organisationMemberRole,
        provisionIfMissing: body.provisionIfMissing,
        teamMemberRole: body.teamMemberRole,
        teamUrl: body.teamUrl,
      });

      return c.json(result, 200);
    } catch (error) {
      mapInternalTeamAccessError(error);
    }
  })
  .delete('/', sValidator('json', ZRevokeInternalTeamAccessRequestSchema), async (c) => {
    requireInternalSecret(c.req.header('authorization'));

    const orgUrl = c.req.param('orgUrl');
    const body = c.req.valid('json');

    if (!orgUrl) {
      throw new HTTPException(400, {
        message: 'Organisation URL is required',
      });
    }

    try {
      await revokeInternalTeamAccess({
        orgUrl,
        organisationMemberId: body.organisationMemberId,
        removeOrgMembership: body.removeOrgMembership,
        teamUrl: body.teamUrl,
      });

      return c.body(null, 204);
    } catch (error) {
      mapInternalTeamAccessError(error);
    }
  });
