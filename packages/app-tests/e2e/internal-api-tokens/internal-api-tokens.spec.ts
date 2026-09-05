import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { hashString } from '@documenso/lib/server-only/auth/hash';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TGetTeamWebhooksResponse } from '@documenso/trpc/server/webhook-router/get-team-webhooks.types';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const V2_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

test.describe('Internal API token creation', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/unknown_team/api-tokens`, {
      data: {
        tokenName: 'Integration Token',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should return 404 for an unknown team', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/unknown_team_${Date.now()}/api-tokens`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        tokenName: 'Integration Token',
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should create a token and authenticate v2 requests', async ({ request }) => {
    const { user, team } = await seedUser();
    const tokenName = `internal-token-${Date.now()}`;

    const createResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/api-tokens`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        tokenName,
        expirationDate: 'THREE_MONTHS',
        userId: user.id,
      },
    });

    expect(createResponse.status()).toBe(201);

    const body = await createResponse.json();

    expect(body.token).toMatch(/^api_/);
    expect(body.teamId).toBe(team.id);
    expect(body.teamUrl).toBe(team.url);
    expect(body.expiresAt).toBeTruthy();

    const storedToken = await prisma.apiToken.findUniqueOrThrow({
      where: {
        id: body.id,
      },
      select: {
        name: true,
        token: true,
        userId: true,
        teamId: true,
      },
    });

    expect(storedToken.name).toBe(tokenName);
    expect(storedToken.token).toBe(hashString(body.token));
    expect(storedToken.token).not.toBe(body.token);
    expect(storedToken.userId).toBe(user.id);
    expect(storedToken.teamId).toBe(team.id);

    const listResponse = await request.get(`${V2_BASE_URL}/webhook`, {
      headers: {
        Authorization: body.token,
      },
    });

    expect(listResponse.ok()).toBeTruthy();

    const webhooks = (await listResponse.json()) as TGetTeamWebhooksResponse;

    expect(Array.isArray(webhooks)).toBe(true);
  });

  test('should return 400 for an invalid expiration date', async ({ request }) => {
    const { team } = await seedUser();

    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/api-tokens`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        tokenName: 'Invalid Expiry Token',
        expirationDate: 'INVALID',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should return 400 when userId is not a team member', async ({ request }) => {
    const { team } = await seedUser();
    const { user: otherUser } = await seedUser();

    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/api-tokens`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        tokenName: 'Wrong User Token',
        userId: otherUser.id,
      },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('Internal API token deletion', () => {
  test('should reject DELETE requests without a secret', async ({ request }) => {
    const response = await request.delete(`${WEBAPP_BASE_URL}/api/internal/teams/unknown_team/api-tokens/1`);

    expect(response.status()).toBe(401);
  });

  test('should return 404 for an unknown team', async ({ request }) => {
    const response = await request.delete(
      `${WEBAPP_BASE_URL}/api/internal/teams/unknown_team_${Date.now()}/api-tokens/1`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(response.status()).toBe(404);
  });

  test('should return 404 for an unknown token id', async ({ request }) => {
    const { team } = await seedUser();

    const response = await request.delete(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/api-tokens/999999999`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should delete a token by teamUrl and tokenId', async ({ request }) => {
    const { user, team } = await seedUser();
    const tokenName = `internal-delete-token-${Date.now()}`;

    const createResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/api-tokens`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        tokenName,
        userId: user.id,
      },
    });

    expect(createResponse.status()).toBe(201);

    const body = await createResponse.json();

    const deleteResponse = await request.delete(
      `${WEBAPP_BASE_URL}/api/internal/teams/${team.url}/api-tokens/${body.id}`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(deleteResponse.status()).toBe(204);

    const storedToken = await prisma.apiToken.findUnique({
      where: {
        id: body.id,
      },
    });

    expect(storedToken).toBeNull();
  });
});
