import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { OrganisationGroupType, TeamMemberRole } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

test.describe('Internal organisation team access API', () => {
  test('should reject requests without a secret', async ({ request }) => {
    const response = await request.put(`${WEBAPP_BASE_URL}/api/internal/organisations/org_missing/team-access`, {
      data: {
        email: 'guest@example.com',
        organisationMemberRole: 'MEMBER',
        teamMemberRole: 'MANAGER',
        teamUrl: 'some_team',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should upsert team access for a provisioned user', async ({ request }) => {
    const { organisation, team } = await seedUser();
    const grantEmail = `team-access-${Date.now()}@test.documenso.com`;

    const response = await request.put(
      `${WEBAPP_BASE_URL}/api/internal/organisations/${organisation.url}/team-access`,
      {
        data: {
          email: grantEmail,
          name: 'Property Manager',
          organisationMemberRole: 'MEMBER',
          provisionIfMissing: true,
          teamMemberRole: 'MANAGER',
          teamUrl: team.url,
        },
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.status).toBe('active');
    expect(body.userId).toBeTruthy();
    expect(body.organisationMemberId).toBeTruthy();

    const organisationMember = await prisma.organisationMember.findFirstOrThrow({
      where: {
        id: body.organisationMemberId,
        organisationId: organisation.id,
      },
      select: {
        id: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    expect(organisationMember.user.email).toBe(grantEmail.toLowerCase());

    const teamManagerMembership = await prisma.organisationGroupMember.findFirst({
      where: {
        organisationMemberId: organisationMember.id,
        group: {
          type: OrganisationGroupType.INTERNAL_TEAM,
          teamGroups: {
            some: {
              teamId: team.id,
              teamRole: TeamMemberRole.MANAGER,
            },
          },
        },
      },
    });

    expect(teamManagerMembership).toBeTruthy();
  });

  test('should revoke team access without removing org membership by default', async ({ request }) => {
    const { organisation, team } = await seedUser();
    const grantEmail = `team-access-revoke-${Date.now()}@test.documenso.com`;

    const upsertResponse = await request.put(
      `${WEBAPP_BASE_URL}/api/internal/organisations/${organisation.url}/team-access`,
      {
        data: {
          email: grantEmail,
          organisationMemberRole: 'MEMBER',
          provisionIfMissing: true,
          teamMemberRole: 'MEMBER',
          teamUrl: team.url,
        },
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(upsertResponse.status()).toBe(200);

    const upsertBody = await upsertResponse.json();

    const deleteResponse = await request.delete(
      `${WEBAPP_BASE_URL}/api/internal/organisations/${organisation.url}/team-access`,
      {
        data: {
          organisationMemberId: upsertBody.organisationMemberId,
          teamUrl: team.url,
        },
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(deleteResponse.status()).toBe(204);

    const teamMembership = await prisma.organisationGroupMember.findFirst({
      where: {
        organisationMemberId: upsertBody.organisationMemberId,
        group: {
          type: OrganisationGroupType.INTERNAL_TEAM,
          teamGroups: {
            some: {
              teamId: team.id,
            },
          },
        },
      },
    });

    expect(teamMembership).toBeNull();

    const orgMember = await prisma.organisationMember.findUnique({
      where: {
        id: upsertBody.organisationMemberId,
      },
    });

    expect(orgMember).toBeTruthy();
  });
});
