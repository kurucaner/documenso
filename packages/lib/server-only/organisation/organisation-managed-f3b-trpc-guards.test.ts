import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  organisation: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const { assertManagedOrganisationDashboardWriteAllowedById, MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE } =
  await import('./assert-managed-organisation-dashboard-write-allowed');

const testDirectory = dirname(fileURLToPath(import.meta.url));
const organisationRouterDirectory = join(testDirectory, '../../../trpc/server/organisation-router');

describe('organisation managed F3b tRPC guards', () => {
  const organisationId = 'org_managed_f3b';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks createOrganisationGroup when the organisation is managed', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({ isManaged: true });

    await expect(assertManagedOrganisationDashboardWriteAllowedById({ organisationId })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
      message: MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
    });
  });

  it('does not guard updateOrganisationBrandingLogo (v1 carve-out)', () => {
    const source = readFileSync(join(organisationRouterDirectory, 'update-organisation-branding-logo.ts'), 'utf8');

    expect(source).not.toContain('assertManagedOrganisationDashboardWriteAllowed');
  });
});
