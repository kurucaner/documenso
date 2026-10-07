import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  team: {
    findFirst: vi.fn(),
  },
  teamGroup: {
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

const isInternalSecretConfiguredMock = vi.hoisted(() => vi.fn());

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('./is-internal-secret-configured', () => ({
  isInternalSecretConfigured: isInternalSecretConfiguredMock,
}));

const { applyInternalTeamIsolationRepair } = await import('./apply-internal-team-isolation-repair');
const { getInternalTeamInheritsOrgMembers } = await import('./get-internal-team-inherits-org-members');

describe('apply-internal-team-isolation-repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isInternalSecretConfiguredMock.mockReturnValue(true);
    prismaMock.team.findFirst.mockResolvedValue({ id: 10, url: 'property_team' });
  });

  it('removes org MEMBER inheritance links and reports counts', async () => {
    prismaMock.teamGroup.findMany.mockResolvedValue([{ id: 'tg_1' }, { id: 'tg_2' }]);
    prismaMock.teamGroup.deleteMany.mockResolvedValue({ count: 2 });

    const result = await applyInternalTeamIsolationRepair({
      orgUrl: 'owner_org',
      teamUrl: 'property_team',
    });

    expect(result).toEqual({
      alreadyIsolated: false,
      removedLinkCount: 2,
      teamUrl: 'property_team',
    });
    expect(prismaMock.teamGroup.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['tg_1', 'tg_2'],
        },
      },
    });
  });

  it('is idempotent when team is already isolated', async () => {
    prismaMock.teamGroup.findMany.mockResolvedValue([]);

    const result = await applyInternalTeamIsolationRepair({
      orgUrl: 'owner_org',
      teamUrl: 'property_team',
    });

    expect(result).toEqual({
      alreadyIsolated: true,
      removedLinkCount: 0,
      teamUrl: 'property_team',
    });
    expect(prismaMock.teamGroup.deleteMany).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when team is missing', async () => {
    prismaMock.team.findFirst.mockResolvedValue(null);

    await expect(
      applyInternalTeamIsolationRepair({
        orgUrl: 'owner_org',
        teamUrl: 'missing_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });
  });
});

describe('get-internal-team-inherits-org-members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isInternalSecretConfiguredMock.mockReturnValue(true);
    prismaMock.team.findFirst.mockResolvedValue({ id: 10, url: 'property_team' });
  });

  it('returns true when org MEMBER inheritance link exists', async () => {
    prismaMock.teamGroup.findFirst.mockResolvedValue({ id: 'tg_1' });

    const result = await getInternalTeamInheritsOrgMembers({
      orgUrl: 'owner_org',
      teamUrl: 'property_team',
    });

    expect(result).toEqual({
      inheritsOrgMembers: true,
      teamUrl: 'property_team',
    });
  });

  it('returns false when team is isolated', async () => {
    prismaMock.teamGroup.findFirst.mockResolvedValue(null);

    const result = await getInternalTeamInheritsOrgMembers({
      orgUrl: 'owner_org',
      teamUrl: 'property_team',
    });

    expect(result).toEqual({
      inheritsOrgMembers: false,
      teamUrl: 'property_team',
    });
  });
});
