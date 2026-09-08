import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

const validUserPayload = (email: string) => ({
  name: 'Provisioned User',
  email,
  password: 'Password123#',
  signature: 'Provisioned User',
});

const provisionInternalUser = async (request: APIRequestContext, email: string) => {
  const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
    headers: {
      Authorization: `Bearer ${INTERNAL_SECRET}`,
    },
    data: validUserPayload(email),
  });

  expect(response.status()).toBe(201);

  return (await response.json()) as {
    email: string;
    orgUrl: string;
    teamUrl: string;
    userId: number;
  };
};

test.describe('Internal bootstrap session API', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/users/1/bootstrap-session`);

    expect(response.status()).toBe(401);
  });

  test('should mint a bootstrap session token for an eligible user', async ({ request }) => {
    const email = `bootstrap-mint-${Date.now()}@example.com`;
    const provisioned = await provisionInternalUser(request, email);

    const response = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/users/${provisioned.userId}/bootstrap-session`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(response.status()).toBe(201);

    const body = await response.json();

    expect(body.bootstrapPath).toBe('/signin/bootstrap');
    expect(body.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());

    const stored = await prisma.bootstrapSessionToken.findFirst({
      where: {
        userId: provisioned.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(body.token);
  });

  test('should return 404 for unknown users', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/users/999999999/bootstrap-session`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 403 when two-factor authentication is enabled', async ({ request }) => {
    const email = `bootstrap-2fa-${Date.now()}@example.com`;
    const provisioned = await provisionInternalUser(request, email);

    await prisma.user.update({
      where: {
        id: provisioned.userId,
      },
      data: {
        twoFactorEnabled: true,
      },
    });

    const response = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/users/${provisioned.userId}/bootstrap-session`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(response.status()).toBe(403);
  });
});
