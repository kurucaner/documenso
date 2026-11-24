import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  organisation: {
    findFirst: vi.fn(),
  },
  team: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const {
  assertManagedOrganisationDashboardWriteAllowed,
  assertManagedOrganisationDashboardWriteAllowedById,
  assertManagedOrganisationDashboardWriteAllowedByTeamId,
  resolveOrganisationIdByTeamId,
  MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
} = await import('./assert-managed-organisation-dashboard-write-allowed');

describe('assertManagedOrganisationDashboardWriteAllowed', () => {
  it('passes when the organisation is not integration-managed', () => {
    expect(() => assertManagedOrganisationDashboardWriteAllowed({ isManaged: false })).not.toThrow();
  });

  it('throws FORBIDDEN when the organisation is integration-managed', () => {
    try {
      assertManagedOrganisationDashboardWriteAllowed({ isManaged: true });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(AppErrorCode.FORBIDDEN);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).message).toBe(MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE);
    }
  });
});

describe('assertManagedOrganisationDashboardWriteAllowedById', () => {
  const organisationId = 'org_managed_test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes when updateOrganisation targets a native organisation', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({ isManaged: false });

    await expect(assertManagedOrganisationDashboardWriteAllowedById({ organisationId })).resolves.toBeUndefined();

    expect(prismaMock.organisation.findFirst).toHaveBeenCalledWith({
      select: { isManaged: true },
      where: { id: organisationId },
    });
  });

  it('throws FORBIDDEN when updateOrganisation targets a managed organisation', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({ isManaged: true });

    await expect(assertManagedOrganisationDashboardWriteAllowedById({ organisationId })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
      message: MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
    });
  });

  it('throws NOT_FOUND when the organisation id does not exist', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue(null);

    await expect(assertManagedOrganisationDashboardWriteAllowedById({ organisationId })).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
      statusCode: 404,
    });
  });
});

describe('resolveOrganisationIdByTeamId', () => {
  const teamId = 42;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the parent organisation id', async () => {
    prismaMock.team.findFirst.mockResolvedValue({ organisationId: 'org_parent' });

    await expect(resolveOrganisationIdByTeamId({ teamId })).resolves.toBe('org_parent');
  });
});

describe('assertManagedOrganisationDashboardWriteAllowedByTeamId', () => {
  const teamId = 42;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes when team.update targets a native organisation', async () => {
    prismaMock.team.findFirst.mockResolvedValue({
      organisation: { isManaged: false },
    });

    await expect(assertManagedOrganisationDashboardWriteAllowedByTeamId({ teamId })).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN when team.update targets a managed organisation', async () => {
    prismaMock.team.findFirst.mockResolvedValue({
      organisation: { isManaged: true },
    });

    await expect(assertManagedOrganisationDashboardWriteAllowedByTeamId({ teamId })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
      message: MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
    });
  });
});
