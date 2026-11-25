import { EnvelopeType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  envelope: {
    findFirst: vi.fn(),
  },
}));

const getTeamByIdMock = vi.hoisted(() => vi.fn());
const getEnvelopeWhereInputMock = vi.hoisted(() => vi.fn());
const getOrganisationTemplateByIdMock = vi.hoisted(() => vi.fn());
const duplicateEnvelopeMock = vi.hoisted(() => vi.fn());

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../team/get-team', () => ({
  getTeamById: getTeamByIdMock,
}));

vi.mock('../envelope/get-envelope-by-id', () => ({
  getEnvelopeWhereInput: getEnvelopeWhereInputMock,
}));

vi.mock('../template/get-organisation-template-by-id', () => ({
  getOrganisationTemplateById: getOrganisationTemplateByIdMock,
}));

vi.mock('./duplicate-envelope', () => ({
  duplicateEnvelope: duplicateEnvelopeMock,
}));

const { copyTemplateToTeam } = await import('./copy-template-to-team');

const requestMetadata = {
  requestMetadata: {
    ipAddress: '127.0.0.1',
    userAgent: 'test',
  },
  source: 'app' as const,
  auth: 'session' as const,
};

describe('copyTemplateToTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getEnvelopeWhereInputMock.mockResolvedValue({
      envelopeWhereInput: { id: 'envelope_test' },
    });
  });

  it('copies a template to another team in the same organisation', async () => {
    getTeamByIdMock.mockImplementation(async ({ teamId }: { teamId: number }) => ({
      id: teamId,
      organisationId: 'org_1',
    }));

    prismaMock.envelope.findFirst.mockResolvedValue({
      id: 'envelope_test',
      type: EnvelopeType.TEMPLATE,
      teamId: 10,
    });

    duplicateEnvelopeMock.mockResolvedValue({
      id: 'envelope_copy',
    });

    const result = await copyTemplateToTeam({
      id: { type: 'envelopeId', id: 'envelope_test' },
      userId: 1,
      contextTeamId: 10,
      targetTeamId: 20,
      requestMetadata,
    });

    expect(result.id).toBe('envelope_copy');
    expect(duplicateEnvelopeMock).toHaveBeenCalledWith({
      id: { type: 'envelopeId', id: 'envelope_test' },
      userId: 1,
      teamId: 10,
      targetTeamId: 20,
      requestMetadata,
      overrides: undefined,
    });
  });

  it('rejects target team in another organisation', async () => {
    getTeamByIdMock.mockImplementation(async ({ teamId }: { teamId: number }) => ({
      id: teamId,
      organisationId: teamId === 10 ? 'org_1' : 'org_2',
    }));

    await expect(
      copyTemplateToTeam({
        id: { type: 'envelopeId', id: 'envelope_test' },
        userId: 1,
        contextTeamId: 10,
        targetTeamId: 20,
        requestMetadata,
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.UNAUTHORIZED,
    });

    expect(duplicateEnvelopeMock).not.toHaveBeenCalled();
  });

  it('rejects when the template cannot be read', async () => {
    getTeamByIdMock.mockImplementation(async ({ teamId }: { teamId: number }) => ({
      id: teamId,
      organisationId: 'org_1',
    }));

    prismaMock.envelope.findFirst.mockResolvedValue(null);
    getOrganisationTemplateByIdMock.mockRejectedValue(
      new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation template not found',
      }),
    );

    await expect(
      copyTemplateToTeam({
        id: { type: 'envelopeId', id: 'envelope_missing' },
        userId: 1,
        contextTeamId: 10,
        targetTeamId: 20,
        requestMetadata,
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });

    expect(duplicateEnvelopeMock).not.toHaveBeenCalled();
  });

  it('rejects non-template envelopes', async () => {
    getTeamByIdMock.mockImplementation(async ({ teamId }: { teamId: number }) => ({
      id: teamId,
      organisationId: 'org_1',
    }));

    prismaMock.envelope.findFirst.mockResolvedValue({
      id: 'envelope_doc',
      type: EnvelopeType.DOCUMENT,
      teamId: 10,
    });

    await expect(
      copyTemplateToTeam({
        id: { type: 'envelopeId', id: 'envelope_doc' },
        userId: 1,
        contextTeamId: 10,
        targetTeamId: 20,
        requestMetadata,
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
    });

    expect(duplicateEnvelopeMock).not.toHaveBeenCalled();
  });

  it('rejects copying to the same team as context', async () => {
    await expect(
      copyTemplateToTeam({
        id: { type: 'envelopeId', id: 'envelope_test' },
        userId: 1,
        contextTeamId: 10,
        targetTeamId: 10,
        requestMetadata,
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
    });

    expect(getTeamByIdMock).not.toHaveBeenCalled();
    expect(duplicateEnvelopeMock).not.toHaveBeenCalled();
  });
});
