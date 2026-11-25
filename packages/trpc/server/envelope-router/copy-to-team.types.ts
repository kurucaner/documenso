import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const copyTemplateToTeamMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/copy-to-team',
    summary: 'Copy template to another team',
    description:
      'Create a copy of a template on a destination team within the same organisation. The source template is unchanged.',
    tags: ['Envelope'],
  },
};

export const ZCopyTemplateToTeamRequestSchema = z.object({
  envelopeId: z.string().min(1).describe('The ID of the template envelope to copy.'),
  targetTeamId: z.number().int().positive().describe('The team that will own the copied template.'),
  includeRecipients: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to copy the recipients to the copied template. Defaults to true.'),
  includeFields: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to copy the fields to the copied template. Requires includeRecipients. Defaults to true.'),
  includeContents: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to copy the contents (text, shapes, images, etc.) to the copied template. Defaults to true.'),
});

export const ZCopyTemplateToTeamResponseSchema = z.object({
  id: z.string().describe('The ID of the newly created template envelope.'),
});

export type TCopyTemplateToTeamRequest = z.infer<typeof ZCopyTemplateToTeamRequestSchema>;
export type TCopyTemplateToTeamResponse = z.infer<typeof ZCopyTemplateToTeamResponseSchema>;
