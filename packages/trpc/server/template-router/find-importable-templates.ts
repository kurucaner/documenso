import { findImportableTemplates } from '@documenso/lib/server-only/template/find-importable-templates';

import { authenticatedProcedure } from '../trpc';
import {
  findImportableTemplatesMeta,
  ZFindImportableTemplatesRequestSchema,
  ZFindImportableTemplatesResponseSchema,
} from './find-importable-templates.types';

export const findImportableTemplatesRoute = authenticatedProcedure
  .meta(findImportableTemplatesMeta)
  .input(ZFindImportableTemplatesRequestSchema)
  .output(ZFindImportableTemplatesResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { sourceTeamId, page, perPage, query } = input;

    ctx.logger.info({
      input: {
        sourceTeamId,
      },
    });

    return await findImportableTemplates({
      userId: ctx.user.id,
      contextTeamId: teamId,
      sourceTeamId,
      page,
      perPage,
      query,
    });
  });
