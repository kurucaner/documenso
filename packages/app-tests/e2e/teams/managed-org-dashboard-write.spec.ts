import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';
const PROVISIONED_USER_PASSWORD = 'Password123#';

test.describe.configure({ mode: 'serial' });

test.describe('@internal Integration-managed org dashboard write guards', () => {
  test('[INTERNAL][TEAMS]: team.update and organisation.update return 403; internal team-access still works', async ({
    page,
    request,
  }) => {
    const email = `managed-dashboard-write-${Date.now()}@example.com`;
    const managedExternalId = crypto.randomUUID();
    const grantEmail = `managed-dashboard-grant-${Date.now()}@example.com`;

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
      orgUrl: string;
    };

    const team = await prisma.team.findFirstOrThrow({
      where: {
        url: body.teamUrl,
      },
      select: {
        id: true,
        name: true,
        url: true,
        organisation: {
          select: {
            id: true,
            isManaged: true,
            url: true,
            name: true,
          },
        },
      },
    });

    expect(team.organisation.isManaged).toBe(true);

    await apiSignin({
      page,
      email: body.email,
      password: PROVISIONED_USER_PASSWORD,
    });

    const teamUpdateResponse = await page.request.post(`${WEBAPP_BASE_URL}/api/trpc/team.update`, {
      headers: {
        ...WEBAPP_ORIGIN_HEADERS,
        'content-type': 'application/json',
        'x-team-id': team.id.toString(),
      },
      data: JSON.stringify({
        json: {
          teamId: team.id,
          data: { name: `${team.name} Renamed` },
        },
      }),
    });

    expect(teamUpdateResponse.ok()).toBeFalsy();
    expect(await teamUpdateResponse.text()).toContain('managed by an integration');

    const teamCreateResponse = await page.request.post(`${WEBAPP_BASE_URL}/api/trpc/team.create`, {
      headers: {
        ...WEBAPP_ORIGIN_HEADERS,
        'content-type': 'application/json',
      },
      data: JSON.stringify({
        json: {
          organisationId: team.organisation.id,
          teamName: 'Blocked Managed Team',
          teamUrl: `blocked-managed-${Date.now()}`,
          inheritMembers: false,
        },
      }),
    });

    expect(teamCreateResponse.ok()).toBeFalsy();
    expect(await teamCreateResponse.text()).toContain('managed by an integration');

    const organisationUpdateResponse = await page.request.post(`${WEBAPP_BASE_URL}/api/trpc/organisation.update`, {
      headers: {
        ...WEBAPP_ORIGIN_HEADERS,
        'content-type': 'application/json',
      },
      data: JSON.stringify({
        json: {
          organisationId: team.organisation.id,
          data: { name: `${team.organisation.name} Renamed`, url: team.organisation.url },
        },
      }),
    });

    expect(organisationUpdateResponse.ok()).toBeFalsy();
    expect(await organisationUpdateResponse.text()).toContain('managed by an integration');

    const teamAccessResponse = await request.put(
      `${WEBAPP_BASE_URL}/api/internal/organisations/${body.orgUrl}/team-access`,
      {
        data: {
          email: grantEmail,
          name: 'Integration Manager',
          organisationMemberRole: 'MEMBER',
          provisionIfMissing: true,
          teamMemberRole: 'MANAGER',
          teamUrl: body.teamUrl,
        },
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(teamAccessResponse.status()).toBe(200);

    const accessBody = (await teamAccessResponse.json()) as { status: string; organisationMemberId: string };

    expect(accessBody.status).toBe('active');
    expect(accessBody.organisationMemberId).toBeTruthy();

    const unchangedTeam = await prisma.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(unchangedTeam.name).toBe(team.name);
  });
});
