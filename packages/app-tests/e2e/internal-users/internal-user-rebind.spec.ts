import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';
import { OrganisationType } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

const internalAuthHeaders = {
  Authorization: `Bearer ${INTERNAL_SECRET}`,
};

const validUserPayload = (email: string) => ({
  name: 'Rebind Test User',
  email,
  password: 'Password123#',
  signature: 'Rebind Test User',
});

test.describe('Internal user rebind API', () => {
  test('should reject by-email requests without a secret', async ({ request }) => {
    const response = await request.get(
      `${WEBAPP_BASE_URL}/api/internal/users/by-email?email=missing-secret@example.com`,
    );

    expect(response.status()).toBe(401);
  });

  test('should return 404 when by-email user does not exist', async ({ request }) => {
    const response = await request.get(
      `${WEBAPP_BASE_URL}/api/internal/users/by-email?email=missing-user-${Date.now()}@example.com`,
      {
        headers: internalAuthHeaders,
      },
    );

    expect(response.status()).toBe(404);
  });

  test('should return user metadata by email after provisioning', async ({ request }) => {
    const email = `rebind-lookup-${Date.now()}@example.com`;

    const provisionResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: internalAuthHeaders,
      data: validUserPayload(email),
    });

    expect(provisionResponse.status()).toBe(201);

    const provisionBody = await provisionResponse.json();

    const lookupResponse = await request.get(
      `${WEBAPP_BASE_URL}/api/internal/users/by-email?email=${encodeURIComponent(email)}`,
      {
        headers: internalAuthHeaders,
      },
    );

    expect(lookupResponse.status()).toBe(200);

    const lookupBody = await lookupResponse.json();

    expect(lookupBody).toEqual({
      email: email.toLowerCase(),
      name: 'Rebind Test User',
      userId: provisionBody.userId,
    });
  });

  test('should create a second organisation for an existing user', async ({ request }) => {
    const email = `rebind-second-org-${Date.now()}@example.com`;

    const provisionResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: internalAuthHeaders,
      data: validUserPayload(email),
    });

    expect(provisionResponse.status()).toBe(201);

    const provisionBody = await provisionResponse.json();
    const secondOrganisationName = 'Second Personal Organisation';

    const createOrgResponse = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/users/${provisionBody.userId}/organisations`,
      {
        headers: internalAuthHeaders,
        data: {
          organisationName: secondOrganisationName,
          teamName: 'Second Personal Team',
        },
      },
    );

    expect(createOrgResponse.status()).toBe(201);

    const createOrgBody = await createOrgResponse.json();

    expect(createOrgBody.userId).toBe(provisionBody.userId);
    expect(createOrgBody.orgUrl).toMatch(/^org_/);
    expect(createOrgBody.teamUrl).toMatch(/^personal_/);
    expect(createOrgBody.organisationId).toBeTruthy();
    expect(createOrgBody.orgUrl).not.toBe(provisionBody.orgUrl);
    expect(createOrgBody.teamUrl).not.toBe(provisionBody.teamUrl);

    const ownedOrganisations = await prisma.organisation.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        name: true,
        type: true,
        url: true,
      },
      where: {
        ownerUserId: provisionBody.userId,
        type: OrganisationType.PERSONAL,
      },
    });

    expect(ownedOrganisations).toHaveLength(2);
    expect(ownedOrganisations.map((organisation) => organisation.url)).toEqual([
      provisionBody.orgUrl,
      createOrgBody.orgUrl,
    ]);
    expect(ownedOrganisations[1]?.name).toBe(secondOrganisationName);
  });

  test('should still return 409 when provisioning a duplicate user email', async ({ request }) => {
    const email = `rebind-duplicate-${Date.now()}@example.com`;

    const firstResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: internalAuthHeaders,
      data: validUserPayload(email),
    });

    expect(firstResponse.status()).toBe(201);

    const duplicateResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: internalAuthHeaders,
      data: validUserPayload(email),
    });

    expect(duplicateResponse.status()).toBe(409);
  });
});
