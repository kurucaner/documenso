import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';
import { OrganisationType } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

const validUserPayload = (email: string) => ({
  name: 'Provisioned User',
  email,
  password: 'Password123#',
  signature: 'Provisioned User',
});

test.describe('Internal user provisioning API', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      data: validUserPayload(`missing-secret-${Date.now()}@example.com`),
    });

    expect(response.status()).toBe(401);
  });

  test('should create a user with custom organisation and team names', async ({ request }) => {
    const email = `internal-user-${Date.now()}@example.com`;
    const organisationName = 'Acme Corp';
    const teamName = 'Legal Team';

    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        ...validUserPayload(email),
        organisationName,
        teamName,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();

    expect(body.email).toBe(email.toLowerCase());
    expect(body.userId).toBeTruthy();
    expect(body.orgUrl).toMatch(/^org_/);
    expect(body.teamUrl).toMatch(/^personal_/);

    const user = await prisma.user.findFirstOrThrow({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        emailVerified: true,
        signature: true,
      },
    });

    expect(user.emailVerified).not.toBeNull();
    expect(user.signature).toBe('Provisioned User');

    const organisation = await prisma.organisation.findFirstOrThrow({
      where: {
        ownerUserId: body.userId,
        type: OrganisationType.PERSONAL,
      },
      include: {
        teams: true,
      },
    });

    expect(organisation.url).toBe(body.orgUrl);
    expect(organisation.name).toBe(organisationName);
    expect(organisation.teams[0]?.url).toBe(body.teamUrl);
    expect(organisation.teams[0]?.name).toBe(teamName);
  });

  test('should return 409 when the email already exists', async ({ request }) => {
    const email = `duplicate-user-${Date.now()}@example.com`;

    const firstResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: validUserPayload(email),
    });

    expect(firstResponse.status()).toBe(201);

    const duplicateResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: validUserPayload(email),
    });

    expect(duplicateResponse.status()).toBe(409);
  });

  test('should return 400 for invalid password or missing signature', async ({ request }) => {
    const email = `invalid-user-${Date.now()}@example.com`;

    const weakPasswordResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        name: 'Provisioned User',
        email,
        password: 'short',
        signature: 'Provisioned User',
      },
    });

    expect(weakPasswordResponse.status()).toBe(400);

    const missingSignatureResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        name: 'Provisioned User',
        email: `missing-signature-${Date.now()}@example.com`,
        password: 'Password123#',
        signature: '',
      },
    });

    expect(missingSignatureResponse.status()).toBe(400);
  });
});
