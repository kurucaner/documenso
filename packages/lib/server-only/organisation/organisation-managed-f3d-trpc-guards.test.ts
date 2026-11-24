import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  team: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const {
  assertManagedOrganisationDashboardWriteAllowedByTeamId,
  MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
} = await import('./assert-managed-organisation-dashboard-write-allowed');

const testDirectory = dirname(fileURLToPath(import.meta.url));
const teamRouterDirectory = join(testDirectory, '../../../trpc/server/team-router');

describe('organisation managed F3d team group tRPC guards', () => {
  const teamId = 9;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks createTeamGroups when the parent organisation is managed', async () => {
    prismaMock.team.findFirst.mockResolvedValue({
      organisation: { isManaged: true },
    });

    await expect(assertManagedOrganisationDashboardWriteAllowedByTeamId({ teamId })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
      message: MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
    });
  });

  it('does not guard updateTeamBrandingLogo (v1 carve-out)', () => {
    const source = readFileSync(join(teamRouterDirectory, 'update-team-branding-logo.ts'), 'utf8');

    expect(source).not.toContain('assertManagedOrganisationDashboardWriteAllowed');
  });
});
