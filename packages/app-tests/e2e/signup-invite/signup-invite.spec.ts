import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';
import { SignupInviteStatus } from '@prisma/client';
import { nanoid } from 'nanoid';

import { signSignaturePad } from '../fixtures/signature';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

test.describe('Signup invite API', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/signup-invites`, {
      data: {
        email: `missing-secret-${Date.now()}@example.com`,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should create, inspect, and revoke a signup invite', async ({ request }) => {
    const email = `signup-invite-${Date.now()}@example.com`;

    const createResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/signup-invites`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        email,
        expiresInDays: 7,
      },
    });

    expect(createResponse.ok()).toBeTruthy();

    const createdInvite = await createResponse.json();

    expect(createdInvite.email).toBe(email.toLowerCase());
    expect(createdInvite.status).toBe('PENDING');
    expect(createdInvite.inviteUrl).toContain(`/signup-invite/${createdInvite.token}`);

    const getResponse = await request.get(`${WEBAPP_BASE_URL}/api/internal/signup-invites/${createdInvite.token}`, {
      headers: {
        Authorization: INTERNAL_SECRET,
      },
    });

    expect(getResponse.ok()).toBeTruthy();

    const fetchedInvite = await getResponse.json();

    expect(fetchedInvite.email).toBe(email.toLowerCase());
    expect(fetchedInvite.status).toBe('PENDING');

    const deleteResponse = await request.delete(
      `${WEBAPP_BASE_URL}/api/internal/signup-invites/${createdInvite.token}`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(deleteResponse.ok()).toBeTruthy();

    const revokedInvite = await deleteResponse.json();

    expect(revokedInvite.status).toBe('REVOKED');
  });
});

test.describe('Signup invite page', () => {
  test('should show pending invite details and locked email', async ({ page }) => {
    const email = `pending-invite-${Date.now()}@example.com`;
    const token = nanoid();
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt,
        status: SignupInviteStatus.PENDING,
      },
    });

    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText("You've been invited to create a Documenso account")).toBeVisible();
    await expect(page.getByText('Invitation details')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText('Invited email')).toBeVisible();
    await expect(page.getByText('Expires')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toHaveValue(email);
    await expect(page.getByLabel('Email Address')).toHaveAttribute('readonly', '');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('should show two-column layout on desktop', async ({ page }) => {
    const email = `desktop-invite-${Date.now()}@example.com`;
    const token = nanoid();
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt,
        status: SignupInviteStatus.PENDING,
      },
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText("You've been invited to create a Documenso account")).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create a new account' })).toBeVisible();
  });

  test('should show expired invite state', async ({ page }) => {
    const email = `expired-invite-${Date.now()}@example.com`;
    const token = nanoid();
    const expiresAt = new Date(Date.now() - 60_000);

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt,
        status: SignupInviteStatus.PENDING,
      },
    });

    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText('Invitation expired')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('should show revoked invite state', async ({ page }) => {
    const email = `revoked-invite-${Date.now()}@example.com`;
    const token = nanoid();

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt: new Date(Date.now() + 86_400_000),
        status: SignupInviteStatus.REVOKED,
      },
    });

    await page.goto(`/signup-invite/${token}`);

    await expect(page.getByText('Invitation revoked')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });
});

test.describe('Signup invite registration', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should complete signup, skip email verification, and sign in automatically', async ({ page, request }) => {
    const email = `invite-signup-${Date.now()}@example.com`;
    const password = 'Password123#';
    const name = 'Invited User';

    const createResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/signup-invites`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        email,
        expiresInDays: 7,
      },
    });

    expect(createResponse.ok()).toBeTruthy();

    const createdInvite = await createResponse.json();

    await page.goto(createdInvite.inviteUrl);

    await page.getByLabel('Full Name').fill(name);
    await expect(page.getByLabel('Email Address')).toHaveValue(email.toLowerCase());
    await page.getByLabel('Password', { exact: true }).fill(password);

    await signSignaturePad(page);

    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    await page.waitForURL((url) => !url.pathname.includes('/unverified-account'));

    const team = await prisma.team.findFirstOrThrow({
      where: {
        organisation: {
          members: {
            some: {
              user: {
                email: email.toLowerCase(),
              },
            },
          },
        },
      },
    });

    await page.waitForURL(`/t/${team.url}/documents`);
    await expect(page).toHaveURL(`/t/${team.url}/documents`);

    const user = await prisma.user.findFirstOrThrow({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        emailVerified: true,
      },
    });

    expect(user.emailVerified).not.toBeNull();

    const invite = await prisma.signupInvite.findFirstOrThrow({
      where: {
        token: createdInvite.token,
      },
      select: {
        status: true,
      },
    });

    expect(invite.status).toBe(SignupInviteStatus.ACCEPTED);
  });

  test('should apply custom organisation and team names from the invite', async ({ page, request }) => {
    const email = `invite-names-${Date.now()}@example.com`;
    const password = 'Password123#';
    const name = 'Invited User';
    const organisationName = 'Acme Corp';
    const teamName = 'Legal Team';

    const createResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/signup-invites`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        email,
        expiresInDays: 7,
        organisationName,
        teamName,
      },
    });

    expect(createResponse.ok()).toBeTruthy();

    const createdInvite = await createResponse.json();

    expect(createdInvite.organisationName).toBe(organisationName);
    expect(createdInvite.teamName).toBe(teamName);

    await page.goto(createdInvite.inviteUrl);

    await page.getByLabel('Full Name').fill(name);
    await page.getByLabel('Password', { exact: true }).fill(password);

    await signSignaturePad(page);

    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    await page.waitForURL((url) => !url.pathname.includes('/unverified-account'));

    const team = await prisma.team.findFirstOrThrow({
      where: {
        organisation: {
          members: {
            some: {
              user: {
                email: email.toLowerCase(),
              },
            },
          },
        },
      },
      include: {
        organisation: true,
      },
    });

    expect(team.name).toBe(teamName);
    expect(team.organisation.name).toBe(organisationName);
  });
});
