import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import WebhookTriggerEventsSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/WebhookTriggerEventsSchema';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateWebhookResponse } from '@documenso/trpc/server/webhook-router/create-webhook.types';
import { expect, test } from '@playwright/test';

const WebhookTriggerEvents = WebhookTriggerEventsSchema.enum;

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const V2_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';
const PROVISIONED_USER_PASSWORD = 'Password123#';

test.describe('Internal team webhook API', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/unknown_team/webhooks`, {
      data: {
        enabled: true,
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED],
        secret: null,
        userId: 1,
        webhookUrl: 'https://example.com/hook',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should return 404 for an unknown team', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/unknown_team_${Date.now()}/webhooks`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        enabled: true,
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED],
        secret: null,
        userId: 1,
        webhookUrl: 'https://example.com/hook',
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should create, list, and delete a webhook', async ({ request }) => {
    const { user, team } = await seedUser();
    const webhookUrl = `https://example.com/webhook-${Date.now()}`;

    const createResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/webhooks`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        enabled: true,
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED, WebhookTriggerEvents.DOCUMENT_SIGNED],
        secret: 'integration-secret',
        userId: user.id,
        webhookUrl,
      },
    });

    expect(createResponse.status()).toBe(201);

    const created = (await createResponse.json()) as TCreateWebhookResponse;

    expect(created.webhookUrl).toBe(webhookUrl);
    expect(created.teamId).toBe(team.id);
    expect(created.userId).toBe(user.id);

    const listResponse = await request.get(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/webhooks`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
    });

    expect(listResponse.ok()).toBeTruthy();

    const listed = (await listResponse.json()) as TCreateWebhookResponse[];

    expect(listed.some((webhook) => webhook.id === created.id)).toBe(true);

    const deleteResponse = await request.delete(
      `${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/webhooks/${created.id}`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(deleteResponse.status()).toBe(204);

    const storedWebhook = await prisma.webhook.findUnique({
      where: {
        id: created.id,
      },
    });

    expect(storedWebhook).toBeNull();
  });

  test('should provision webhooks on integration-managed teams when v2 webhook create is blocked', async ({
    request,
  }) => {
    const email = `internal-webhook-managed-${Date.now()}@example.com`;
    const managedExternalId = crypto.randomUUID();

    const provisionResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        disableAccountDeletion: true,
        email,
        managedExternalId,
        name: 'Managed Webhook User',
        password: PROVISIONED_USER_PASSWORD,
        signature: 'Managed Webhook User',
      },
    });

    expect(provisionResponse.status()).toBe(201);

    const provisionBody = (await provisionResponse.json()) as {
      teamUrl: string;
      userId: number;
    };

    const team = await prisma.team.findFirstOrThrow({
      select: {
        id: true,
        organisation: {
          select: {
            isManaged: true,
          },
        },
      },
      where: {
        url: provisionBody.teamUrl,
      },
    });

    expect(team.organisation.isManaged).toBe(true);

    const tokenResponse = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/teams/${provisionBody.teamUrl}/api-tokens`,
      {
        data: {
          tokenName: `token-${Date.now()}`,
          userId: provisionBody.userId,
        },
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(tokenResponse.status()).toBe(201);

    const tokenBody = (await tokenResponse.json()) as { token: string };

    const blockedV2Response = await request.post(`${V2_BASE_URL}/webhook/create`, {
      data: {
        enabled: true,
        eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED],
        secret: null,
        webhookUrl: 'https://example.com/blocked-v2',
      },
      headers: {
        Authorization: tokenBody.token,
      },
    });

    expect(blockedV2Response.status()).toBe(403);

    const webhookUrl = `https://example.com/managed-${Date.now()}`;

    const internalCreateResponse = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/teams/${provisionBody.teamUrl}/webhooks`,
      {
        data: {
          enabled: true,
          eventTriggers: [WebhookTriggerEvents.DOCUMENT_COMPLETED],
          secret: 'managed-hook-secret',
          userId: provisionBody.userId,
          webhookUrl,
        },
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(internalCreateResponse.status()).toBe(201);

    const webhook = (await internalCreateResponse.json()) as TCreateWebhookResponse;

    expect(webhook.webhookUrl).toBe(webhookUrl);
    expect(webhook.teamId).toBe(team.id);
  });
});
