import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { hashBootstrapSessionToken } from '@documenso/lib/server-only/internal-api/bootstrap-session-token';
import { prisma } from '@documenso/prisma';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { checkSessionValid } from '../fixtures/authentication';

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

const mintBootstrapSession = async (request: APIRequestContext, userId: number) => {
  const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/users/${userId}/bootstrap-session`, {
    headers: {
      Authorization: `Bearer ${INTERNAL_SECRET}`,
    },
  });

  expect(response.status()).toBe(201);

  return (await response.json()) as {
    bootstrapPath: string;
    expiresAt: string;
    token: string;
  };
};

test.describe('Bootstrap sign-in route', () => {
  test('should establish a session and redirect to returnTo', async ({ page, request }) => {
    const email = `bootstrap-signin-${Date.now()}@example.com`;
    const provisioned = await provisionInternalUser(request, email);
    const minted = await mintBootstrapSession(request, provisioned.userId);

    await page.goto(
      `${WEBAPP_BASE_URL}${minted.bootstrapPath}?token=${encodeURIComponent(minted.token)}&returnTo=${encodeURIComponent('/')}`,
    );

    await page.waitForURL(`${WEBAPP_BASE_URL}/`);

    expect(await checkSessionValid(page)).toBe(true);
  });

  test('should redirect already authenticated users without consuming the token', async ({ page, request }) => {
    const email = `bootstrap-authed-${Date.now()}@example.com`;
    const provisioned = await provisionInternalUser(request, email);
    const minted = await mintBootstrapSession(request, provisioned.userId);

    await page.goto(
      `${WEBAPP_BASE_URL}${minted.bootstrapPath}?token=${encodeURIComponent(minted.token)}&returnTo=${encodeURIComponent('/')}`,
    );
    await page.waitForURL(`${WEBAPP_BASE_URL}/`);
    expect(await checkSessionValid(page)).toBe(true);

    const mintedWhileAuthed = await mintBootstrapSession(request, provisioned.userId);

    await page.goto(
      `${WEBAPP_BASE_URL}${mintedWhileAuthed.bootstrapPath}?token=${encodeURIComponent(mintedWhileAuthed.token)}&returnTo=${encodeURIComponent('/')}`,
    );
    await page.waitForURL(`${WEBAPP_BASE_URL}/`);
    expect(await checkSessionValid(page)).toBe(true);

    const tokenHash = hashBootstrapSessionToken(mintedWhileAuthed.token);
    const stored = await prisma.bootstrapSessionToken.findUnique({
      where: {
        tokenHash,
      },
    });

    expect(stored?.consumedAt).toBeNull();
  });

  test('should redirect invalid tokens to sign-in with bootstrap_expired', async ({ page }) => {
    await page.goto(`${WEBAPP_BASE_URL}/signin/bootstrap?token=invalid-bootstrap-token`);

    await page.waitForURL(/\/signin\?error=bootstrap_expired$/);
    expect(await checkSessionValid(page)).toBe(false);
  });

  test('should reject a reused bootstrap token', async ({ page, request }) => {
    const email = `bootstrap-reuse-${Date.now()}@example.com`;
    const provisioned = await provisionInternalUser(request, email);
    const minted = await mintBootstrapSession(request, provisioned.userId);
    const bootstrapUrl = `${WEBAPP_BASE_URL}${minted.bootstrapPath}?token=${encodeURIComponent(minted.token)}&returnTo=${encodeURIComponent('/')}`;

    await page.goto(bootstrapUrl);
    await page.waitForURL(`${WEBAPP_BASE_URL}/`);
    expect(await checkSessionValid(page)).toBe(true);

    await page.context().clearCookies();

    await page.goto(bootstrapUrl);
    await page.waitForURL(/\/signin\?error=bootstrap_expired$/);
    expect(await checkSessionValid(page)).toBe(false);
  });
});
