import { copyTemplateToTeam } from '@documenso/lib/server-only/envelope/copy-template-to-team';

import { authenticatedProcedure } from '../trpc';
import {
  copyTemplateToTeamMeta,
  ZCopyTemplateToTeamRequestSchema,
  ZCopyTemplateToTeamResponseSchema,
} from './copy-to-team.types';

export const copyTemplateToTeamRoute = authenticatedProcedure
  .meta(copyTemplateToTeamMeta)
  .input(ZCopyTemplateToTeamRequestSchema)
  .output(ZCopyTemplateToTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, targetTeamId, includeRecipients, includeFields, includeContents } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        targetTeamId,
      },
    });

    const copiedTemplate = await copyTemplateToTeam({
      userId: ctx.user.id,
      contextTeamId: teamId,
      targetTeamId,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      requestMetadata: ctx.metadata,
      overrides: {
        includeRecipients,
        includeFields,
        includeContents,
      },
    });

    return {
      id: copiedTemplate.id,
    };
  });
