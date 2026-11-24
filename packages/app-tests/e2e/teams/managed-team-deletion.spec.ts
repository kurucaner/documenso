import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';
const PROVISIONED_USER_PASSWORD = 'Password123#';

test.describe.configure({ mode: 'serial' });

test.describe('@internal Integration-managed team deletion (org isManaged policy)', () => {
  test('[INTERNAL][TEAMS]: dashboard team.delete is blocked; internal DELETE removes the team', async ({
    page,
    request,
  }) => {
    const email = `managed-team-delete-${Date.now()}@example.com`;
    const managedExternalId = crypto.randomUUID();

    const provisionResponse = await request.post(`${WEBAPP_BASE_URL}/api/internal/users`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        name: 'Provisioned User',
        email,
        password: PROVISIONED_USER_PASSWORD,
        signature: 'Provisioned User',
        managedExternalId,
      },
    });

    expect(provisionResponse.status()).toBe(201);

    const body = (await provisionResponse.json()) as {
      email: string;
      teamUrl: string;
    };

    const team = await prisma.team.findFirstOrThrow({
      where: {
        url: body.teamUrl,
      },
      select: {
        id: true,
        managedExternalId: true,
        organisation: {
          select: {
            isManaged: true,
          },
        },
      },
    });

    expect(team.organisation.isManaged).toBe(true);
    expect(team.managedExternalId).toBe(managedExternalId);

    await apiSignin({
      page,
      email: body.email,
      password: PROVISIONED_USER_PASSWORD,
    });

    const dashboardDeleteResponse = await page.request.post(`${WEBAPP_BASE_URL}/api/trpc/team.delete`, {
      headers: {
        ...WEBAPP_ORIGIN_HEADERS,
        'content-type': 'application/json',
        'x-team-id': team.id.toString(),
      },
      data: JSON.stringify({ json: { teamId: team.id } }),
    });

    expect(dashboardDeleteResponse.ok()).toBeFalsy();
    expect(await dashboardDeleteResponse.text()).toContain('managed by an integration');

    const teamBeforeInternalDelete = await prisma.team.findUnique({
      where: { id: team.id },
    });
    expect(teamBeforeInternalDelete).not.toBeNull();

    const internalDeleteResponse = await request.delete(`${WEBAPP_BASE_URL}/api/internal/teams/${body.teamUrl}`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        managedExternalId,
      },
    });

    expect(internalDeleteResponse.status()).toBe(204);

    const teamAfterInternalDelete = await prisma.team.findUnique({
      where: { id: team.id },
    });
    expect(teamAfterInternalDelete).toBeNull();
  });
});
