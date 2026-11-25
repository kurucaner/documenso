import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const findImportableTemplatesMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/template/find-importable-templates',
    summary: 'Find templates importable from another team',
    description: 'List templates on a source team that the authenticated user may copy into the current team context.',
    tags: ['Template'],
  },
};

export const ZFindImportableTemplatesRequestSchema = ZFindSearchParamsSchema.extend({
  sourceTeamId: z.number().int().positive().describe('The team to list importable templates from.'),
});

export const ZImportableTemplateRowSchema = z.object({
  envelopeId: z.string().describe('The envelope ID of the template.'),
  title: z.string().describe('The template title.'),
  teamId: z.number().describe('The owning team ID.'),
  templateType: z.nativeEnum(TemplateType).nullable().describe('The template visibility type.'),
});

export const ZFindImportableTemplatesResponseSchema = z.object({
  data: z.array(ZImportableTemplateRowSchema),
  count: z.number().describe('The total number of items.'),
  currentPage: z.number().describe('The current page number, starts at 1.'),
  perPage: z.number().describe('The number of items per page.'),
  totalPages: z.number().describe('The total number of pages.'),
});

export type TFindImportableTemplatesRequest = z.infer<typeof ZFindImportableTemplatesRequestSchema>;
export type TFindImportableTemplatesResponse = z.infer<typeof ZFindImportableTemplatesResponseSchema>;
