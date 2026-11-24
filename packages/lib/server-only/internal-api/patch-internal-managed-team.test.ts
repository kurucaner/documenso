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

const updateTeamDisplayNameForIntegrationMock = vi.hoisted(() => vi.fn());
const getInternalTeamMock = vi.hoisted(() => vi.fn());

vi.mock('../team/update-team', () => ({
  updateTeamDisplayNameForIntegration: updateTeamDisplayNameForIntegrationMock,
}));

vi.mock('./get-internal-team', () => ({
  getInternalTeam: getInternalTeamMock,
}));

vi.mock('./is-internal-secret-configured', () => ({
  isInternalSecretConfigured: vi.fn(() => true),
}));

const { patchInternalManagedTeam } = await import('./patch-internal-managed-team');

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

describe('patchInternalManagedTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.team.findFirst.mockResolvedValue({
      id: 7,
      managedExternalId: PROPERTY_ID,
      organisation: {
        isManaged: true,
      },
      url: 'my_team',
    });
    getInternalTeamMock.mockResolvedValue({
      organisationId: 'org_test',
      orgUrl: 'org_test',
      teamId: 7,
      teamName: 'Renamed Property',
      teamUrl: 'my_team',
    });
  });

  it('updates display name when external id matches', async () => {
    const result = await patchInternalManagedTeam({
      managedExternalId: PROPERTY_ID,
      name: 'Renamed Property',
      teamUrl: 'My_Team',
    });

    expect(prismaMock.team.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        managedExternalId: true,
        organisation: {
          select: {
            isManaged: true,
          },
        },
        url: true,
      },
      where: {
        url: 'my_team',
      },
    });
    expect(updateTeamDisplayNameForIntegrationMock).toHaveBeenCalledWith({
      name: 'Renamed Property',
      teamId: 7,
    });
    expect(result.teamName).toBe('Renamed Property');
  });

  it('returns NOT_FOUND when the team does not exist', async () => {
    prismaMock.team.findFirst.mockResolvedValue(null);

    await expect(
      patchInternalManagedTeam({
        managedExternalId: PROPERTY_ID,
        name: 'Renamed Property',
        teamUrl: 'missing',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });

    expect(updateTeamDisplayNameForIntegrationMock).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the external id does not match', async () => {
    await expect(
      patchInternalManagedTeam({
        managedExternalId: OTHER_PROPERTY_ID,
        name: 'Renamed Property',
        teamUrl: 'my_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });

    expect(updateTeamDisplayNameForIntegrationMock).not.toHaveBeenCalled();
  });

  it('returns INVALID_REQUEST when the organisation is not integration-managed', async () => {
    prismaMock.team.findFirst.mockResolvedValue({
      id: 7,
      managedExternalId: PROPERTY_ID,
      organisation: {
        isManaged: false,
      },
      url: 'my_team',
    });

    await expect(
      patchInternalManagedTeam({
        managedExternalId: PROPERTY_ID,
        name: 'Renamed Property',
        teamUrl: 'my_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
    });

    expect(updateTeamDisplayNameForIntegrationMock).not.toHaveBeenCalled();
  });
});
