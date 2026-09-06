import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

test.describe('Internal organisation team creation', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/organisations/org_missing/teams`, {
      data: {
        teamName: 'Property Team',
        userId: 1,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should return 404 for an unknown organisation', async ({ request }) => {
    const response = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/organisations/org_missing_${Date.now()}/teams`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
        data: {
          teamName: 'Property Team',
          userId: 1,
        },
      },
    );

    expect(response.status()).toBe(404);
  });

  test('should create a team under an existing organisation', async ({ request }) => {
    const { user, organisation, team: existingTeam } = await seedUser();
    const teamName = `Property ${Date.now()}`;

    const createResponse = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/organisations/${organisation.url}/teams`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
        data: {
          teamName,
          userId: user.id,
        },
      },
    );

    expect(createResponse.status()).toBe(201);

    const body = await createResponse.json();

    expect(body.teamId).toBeTruthy();
    expect(body.teamUrl).toBeTruthy();
    expect(body.organisationId).toBe(organisation.id);
    expect(body.teamId).not.toBe(existingTeam.id);

    const createdTeam = await prisma.team.findUniqueOrThrow({
      where: {
        id: body.teamId,
      },
      select: {
        name: true,
        organisationId: true,
        url: true,
      },
    });

    expect(createdTeam.name).toBe(teamName);
    expect(createdTeam.organisationId).toBe(organisation.id);
    expect(createdTeam.url).toBe(body.teamUrl);
  });

  test('should accept an explicit teamUrl', async ({ request }) => {
    const { user, organisation } = await seedUser();
    const teamUrl = `prop_${Date.now().toString(36).slice(-8)}`;

    const createResponse = await request.post(
      `${WEBAPP_BASE_URL}/api/internal/organisations/${organisation.url}/teams`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
        data: {
          teamName: 'Explicit URL Property',
          userId: user.id,
          teamUrl,
        },
      },
    );

    expect(createResponse.status()).toBe(201);

    const body = await createResponse.json();

    expect(body.teamUrl).toBe(teamUrl);
  });

  test('should return 409 when teamUrl already exists', async ({ request }) => {
    const { user, organisation, team } = await seedUser();

    const response = await request.post(`${WEBAPP_BASE_URL}/api/internal/organisations/${organisation.url}/teams`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
      data: {
        teamName: 'Duplicate URL Team',
        userId: user.id,
        teamUrl: team.url,
      },
    });

    expect(response.status()).toBe(409);
  });
});

test.describe('Internal team lookup', () => {
  test('should reject GET requests without a secret', async ({ request }) => {
    const response = await request.get(`${WEBAPP_BASE_URL}/api/internal/teams/team_missing`);

    expect(response.status()).toBe(401);
  });

  test('should return 404 for an unknown team', async ({ request }) => {
    const response = await request.get(`${WEBAPP_BASE_URL}/api/internal/teams/team_missing_${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should return current team metadata by teamUrl', async ({ request }) => {
    const { organisation, team } = await seedUser();
    const renamedTeamName = `Renamed Team ${Date.now()}`;

    await prisma.team.update({
      where: {
        id: team.id,
      },
      data: {
        name: renamedTeamName,
      },
    });

    const response = await request.get(`${WEBAPP_BASE_URL}/api/internal/teams/${team.url}`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.teamId).toBe(team.id);
    expect(body.teamUrl).toBe(team.url);
    expect(body.teamName).toBe(renamedTeamName);
    expect(body.organisationId).toBeTruthy();
    expect(body.orgUrl).toBe(organisation.url);
  });

  test('should return current team metadata by numeric teamId', async ({ request }) => {
    const { team } = await seedUser();

    const response = await request.get(`${WEBAPP_BASE_URL}/api/internal/teams/${team.id}`, {
      headers: {
        Authorization: `Bearer ${INTERNAL_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.teamId).toBe(team.id);
    expect(body.teamUrl).toBe(team.url);
    expect(body.teamName).toBe(team.name);
  });
});
