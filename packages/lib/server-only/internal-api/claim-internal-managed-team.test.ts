import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  team: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const getInternalTeamMock = vi.hoisted(() => vi.fn());

vi.mock('./get-internal-team', () => ({
  getInternalTeam: getInternalTeamMock,
}));

vi.mock('./is-internal-secret-configured', () => ({
  isInternalSecretConfigured: vi.fn(() => true),
}));

const { claimInternalManagedTeam } = await import('./claim-internal-managed-team');

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

describe('claimInternalManagedTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.team.findFirst.mockImplementation(async (args: { where?: { id?: { not?: number } } }) => {
      if (args.where?.id?.not != null) {
        return null;
      }

      return {
        id: 7,
        managedExternalId: null,
        organisation: {
          isManaged: true,
        },
        url: 'my_team',
      };
    });
    getInternalTeamMock.mockResolvedValue({
      managedExternalId: PROPERTY_ID,
      organisationId: 'org_test',
      orgUrl: 'org_test',
      teamId: 7,
      teamName: 'Test Property',
      teamUrl: 'my_team',
    });
  });

  it('claims managedExternalId when unset', async () => {
    const result = await claimInternalManagedTeam({
      managedExternalId: PROPERTY_ID,
      teamUrl: 'my_team',
    });

    expect(prismaMock.team.update).toHaveBeenCalledWith({
      data: {
        managedExternalId: PROPERTY_ID,
      },
      where: {
        id: 7,
      },
    });
    expect(result.managedExternalId).toBe(PROPERTY_ID);
  });

  it('is idempotent when already claimed for the same property', async () => {
    prismaMock.team.findFirst.mockResolvedValue({
      id: 7,
      managedExternalId: PROPERTY_ID,
      organisation: {
        isManaged: true,
      },
      url: 'my_team',
    });

    await claimInternalManagedTeam({
      managedExternalId: PROPERTY_ID,
      teamUrl: 'my_team',
    });

    expect(prismaMock.team.update).not.toHaveBeenCalled();
    expect(getInternalTeamMock).toHaveBeenCalled();
  });

  it('rejects when team already linked to another external id', async () => {
    prismaMock.team.findFirst.mockResolvedValue({
      id: 7,
      managedExternalId: OTHER_PROPERTY_ID,
      organisation: {
        isManaged: true,
      },
      url: 'my_team',
    });

    await expect(
      claimInternalManagedTeam({
        managedExternalId: PROPERTY_ID,
        teamUrl: 'my_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
    });
  });
});
