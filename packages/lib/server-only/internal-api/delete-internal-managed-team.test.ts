import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  team: {
    delete: vi.fn(),
    findFirst: vi.fn(),
  },
  organisationGroup: {
    deleteMany: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const orphanEnvelopesMock = vi.hoisted(() => vi.fn());

vi.mock('../envelope/orphan-envelopes', () => ({
  orphanEnvelopes: orphanEnvelopesMock,
}));

vi.mock('./is-internal-secret-configured', () => ({
  isInternalSecretConfigured: vi.fn(() => true),
}));

const { deleteInternalManagedTeam } = await import('./delete-internal-managed-team');

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROPERTY_ID = '22222222-2222-4222-8222-222222222222';

describe('deleteInternalManagedTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.team.findFirst.mockResolvedValue({
      id: 7,
      organisationId: 'org_test',
      propertyOsManaged: true,
      propertyOsPropertyId: PROPERTY_ID,
    });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        organisationGroup: prismaMock.organisationGroup,
        team: prismaMock.team,
      }),
    );
    orphanEnvelopesMock.mockResolvedValue(undefined);
  });

  it('deletes a managed team when the property id matches', async () => {
    await deleteInternalManagedTeam({
      propertyOsPropertyId: PROPERTY_ID,
      teamUrl: 'My_Team',
    });

    expect(prismaMock.team.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        organisationId: true,
        propertyOsManaged: true,
        propertyOsPropertyId: true,
      },
      where: {
        url: 'my_team',
      },
    });
    expect(orphanEnvelopesMock).toHaveBeenCalledWith({ teamId: 7 });
    expect(prismaMock.team.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('returns NOT_FOUND when the team does not exist', async () => {
    prismaMock.team.findFirst.mockResolvedValue(null);

    await expect(
      deleteInternalManagedTeam({
        propertyOsPropertyId: PROPERTY_ID,
        teamUrl: 'missing',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });

    expect(orphanEnvelopesMock).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the property id does not match', async () => {
    await expect(
      deleteInternalManagedTeam({
        propertyOsPropertyId: OTHER_PROPERTY_ID,
        teamUrl: 'my_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });

    expect(orphanEnvelopesMock).not.toHaveBeenCalled();
  });

  it('returns INVALID_REQUEST when the team is not PropertyOS-managed', async () => {
    prismaMock.team.findFirst.mockResolvedValue({
      id: 7,
      organisationId: 'org_test',
      propertyOsManaged: false,
      propertyOsPropertyId: PROPERTY_ID,
    });

    await expect(
      deleteInternalManagedTeam({
        propertyOsPropertyId: PROPERTY_ID,
        teamUrl: 'my_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
    });

    expect(orphanEnvelopesMock).not.toHaveBeenCalled();
  });
});
