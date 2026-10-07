import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const INTERNAL_SECRET = process.env.NEXT_PRIVATE_INTERNAL_SECRET ?? 'test-internal-secret';

const teamIsolationBasePath = (orgUrl: string, teamUrl: string) =>
  `${WEBAPP_BASE_URL}/api/internal/organisations/${orgUrl}/teams/${teamUrl}`;

test.describe('Internal organisation team isolation API', () => {
  test('should reject probe requests without a secret', async ({ request }) => {
    const { organisation, team } = await seedUser();

    const response = await request.get(`${teamIsolationBasePath(organisation.url, team.url)}/inherits-org-members`);

    expect(response.status()).toBe(401);
  });

  test('should report inheritance and apply isolation repair', async ({ request }) => {
    const { organisation, team } = await seedUser({ inheritMembers: true });

    const orgMemberGroup = await prisma.organisationGroup.findFirstOrThrow({
      where: {
        organisationId: organisation.id,
        organisationRole: OrganisationMemberRole.MEMBER,
        type: OrganisationGroupType.INTERNAL_ORGANISATION,
      },
      select: {
        id: true,
      },
    });

    const inheritanceLinkBefore = await prisma.teamGroup.findFirst({
      where: {
        organisationGroupId: orgMemberGroup.id,
        teamId: team.id,
      },
    });

    expect(inheritanceLinkBefore).toBeTruthy();

    const probeBeforeResponse = await request.get(
      `${teamIsolationBasePath(organisation.url, team.url)}/inherits-org-members`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(probeBeforeResponse.status()).toBe(200);

    const probeBefore = await probeBeforeResponse.json();

    expect(probeBefore.inheritsOrgMembers).toBe(true);
    expect(probeBefore.teamUrl).toBe(team.url);

    const repairResponse = await request.post(
      `${teamIsolationBasePath(organisation.url, team.url)}/apply-isolation-repair`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(repairResponse.status()).toBe(200);

    const repairBody = await repairResponse.json();

    expect(repairBody.removedLinkCount).toBeGreaterThanOrEqual(1);
    expect(repairBody.alreadyIsolated).toBe(false);
    expect(repairBody.teamUrl).toBe(team.url);

    const inheritanceLinkAfter = await prisma.teamGroup.findFirst({
      where: {
        organisationGroupId: orgMemberGroup.id,
        teamId: team.id,
      },
    });

    expect(inheritanceLinkAfter).toBeNull();

    const probeAfterResponse = await request.get(
      `${teamIsolationBasePath(organisation.url, team.url)}/inherits-org-members`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(probeAfterResponse.status()).toBe(200);

    const probeAfter = await probeAfterResponse.json();

    expect(probeAfter.inheritsOrgMembers).toBe(false);

    const repairAgainResponse = await request.post(
      `${teamIsolationBasePath(organisation.url, team.url)}/apply-isolation-repair`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(repairAgainResponse.status()).toBe(200);

    const repairAgainBody = await repairAgainResponse.json();

    expect(repairAgainBody.alreadyIsolated).toBe(true);
    expect(repairAgainBody.removedLinkCount).toBe(0);
  });

  test('should return 404 when team is missing', async ({ request }) => {
    const { organisation } = await seedUser();

    const response = await request.get(
      `${teamIsolationBasePath(organisation.url, 'missing_team_slug')}/inherits-org-members`,
      {
        headers: {
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
      },
    );

    expect(response.status()).toBe(404);
  });
});
