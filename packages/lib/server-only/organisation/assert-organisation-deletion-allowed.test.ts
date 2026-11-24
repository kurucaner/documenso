import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE } from './assert-managed-organisation-dashboard-write-allowed';

const prismaMock = vi.hoisted(() => ({
  organisation: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const { assertOrganisationDeletionAllowed, assertOrganisationDeletionAllowedById } = await import(
  './assert-organisation-deletion-allowed'
);

describe('assertOrganisationDeletionAllowed (org isManaged only)', () => {
  it('passes when the organisation is not integration-managed', () => {
    expect(() =>
      assertOrganisationDeletionAllowed({
        isManaged: false,
      }),
    ).not.toThrow();
  });

  it('throws FORBIDDEN when the organisation is integration-managed', () => {
    try {
      assertOrganisationDeletionAllowed({
        isManaged: true,
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(AppErrorCode.FORBIDDEN);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).message).toBe(MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE);
    }
  });
});

describe('assertOrganisationDeletionAllowedById', () => {
  const organisationId = 'org_managed_delete';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to the organisation isManaged flag, not per-team managed state', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({ isManaged: true });

    await expect(assertOrganisationDeletionAllowedById({ organisationId })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
      message: MANAGED_ORGANISATION_DASHBOARD_WRITE_FORBIDDEN_MESSAGE,
    });

    expect(prismaMock.organisation.findFirst).toHaveBeenCalledWith({
      select: { isManaged: true },
      where: { id: organisationId },
    });
  });
});
