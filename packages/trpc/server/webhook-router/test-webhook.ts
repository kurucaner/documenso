import { assertManagedOrganisationDashboardWriteAllowedByTeamId } from '@documenso/lib/server-only/organisation/assert-managed-organisation-dashboard-write-allowed';
import { triggerTestWebhook } from '@documenso/lib/server-only/webhooks/trigger-test-webhook';

import { authenticatedProcedure } from '../trpc';
import { testWebhookMeta, ZTestWebhookRequestSchema, ZTestWebhookResponseSchema } from './test-webhook.types';

export const testWebhookRoute = authenticatedProcedure
  .meta(testWebhookMeta)
  .input(ZTestWebhookRequestSchema)
  .output(ZTestWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, event } = input;

    ctx.logger.info({
      input: {
        id,
        event,
      },
    });

    await assertManagedOrganisationDashboardWriteAllowedByTeamId({ teamId: ctx.teamId });

    return await triggerTestWebhook({
      id,
      event,
      userId: ctx.user.id,
      teamId: ctx.teamId,
    });
  });
