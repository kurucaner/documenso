import { EnvelopeType, TemplateType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  envelope: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

const getTeamByIdMock = vi.hoisted(() => vi.fn());
const getMemberRolesMock = vi.hoisted(() => vi.fn());

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../team/get-team', () => ({
  getTeamById: getTeamByIdMock,
}));

vi.mock('../team/get-member-roles', () => ({
  getMemberRoles: getMemberRolesMock,
}));

const { findImportableTemplates } = await import('./find-importable-templates');

describe('findImportableTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getMemberRolesMock.mockResolvedValue({ teamRole: 'ADMIN' });
  });

  it('returns importable template rows for the source team', async () => {
    getTeamByIdMock.mockImplementation(async ({ teamId }: { teamId: number }) => ({
      id: teamId,
      organisationId: 'org_1',
    }));

    prismaMock.envelope.findMany.mockResolvedValue([
      {
        id: 'envelope_1',
        title: 'Lease template',
        teamId: 20,
        templateType: TemplateType.PRIVATE,
      },
    ]);
    prismaMock.envelope.count.mockResolvedValue(1);

    const result = await findImportableTemplates({
      userId: 1,
      contextTeamId: 10,
      sourceTeamId: 20,
      page: 1,
      perPage: 10,
    });

    expect(result.count).toBe(1);
    expect(result.data).toEqual([
      {
        envelopeId: 'envelope_1',
        title: 'Lease template',
        teamId: 20,
        templateType: TemplateType.PRIVATE,
      },
    ]);

    const findManyArgs = prismaMock.envelope.findMany.mock.calls[0]?.[0];
    expect(findManyArgs?.where?.type).toBe(EnvelopeType.TEMPLATE);
    expect(findManyArgs?.where?.teamId).toBe(20);
  });

  it('returns an empty page when teams are in different organisations', async () => {
    getTeamByIdMock.mockImplementation(async ({ teamId }: { teamId: number }) => ({
      id: teamId,
      organisationId: teamId === 10 ? 'org_1' : 'org_2',
    }));

    const result = await findImportableTemplates({
      userId: 1,
      contextTeamId: 10,
      sourceTeamId: 20,
    });

    expect(result).toEqual({
      data: [],
      count: 0,
      currentPage: 1,
      perPage: 10,
      totalPages: 0,
    });

    expect(prismaMock.envelope.findMany).not.toHaveBeenCalled();
  });

  it('rejects when the user is not a member of the source team', async () => {
    getTeamByIdMock.mockImplementation(({ teamId }: { teamId: number }) => {
      if (teamId === 20) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Team not found',
        });
      }

      return Promise.resolve({
        id: teamId,
        organisationId: 'org_1',
      });
    });

    await expect(
      findImportableTemplates({
        userId: 1,
        contextTeamId: 10,
        sourceTeamId: 20,
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });
  });
});
