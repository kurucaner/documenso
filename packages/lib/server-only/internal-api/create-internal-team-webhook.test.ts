import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  team: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  webhook: {
    create: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('./is-internal-secret-configured', () => ({
  isInternalSecretConfigured: vi.fn(() => true),
}));

const { createInternalTeamWebhook } = await import('./create-internal-team-webhook');

describe('createInternalTeamWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.team.findUnique.mockResolvedValue({
      id: 42,
      organisation: {
        isManaged: true,
      },
    });
    prismaMock.team.findFirst.mockResolvedValue({ id: 42 });
    prismaMock.webhook.create.mockResolvedValue({
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      enabled: true,
      eventTriggers: ['DOCUMENT_COMPLETED'],
      id: 'wh_test',
      secret: 'secret',
      teamId: 42,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      userId: 7,
      webhookUrl: 'https://api.example.com/webhooks/documenso',
    });
  });

  it('creates a webhook when the organisation is managed', async () => {
    const result = await createInternalTeamWebhook({
      enabled: true,
      eventTriggers: ['DOCUMENT_COMPLETED'],
      secret: 'secret',
      teamUrl: 'managed_team',
      userId: 7,
      webhookUrl: 'https://api.example.com/webhooks/documenso',
    });

    expect(prismaMock.webhook.create).toHaveBeenCalledWith({
      data: {
        enabled: true,
        eventTriggers: ['DOCUMENT_COMPLETED'],
        secret: 'secret',
        teamId: 42,
        userId: 7,
        webhookUrl: 'https://api.example.com/webhooks/documenso',
      },
    });
    expect(result.id).toBe('wh_test');
  });

  it('returns NOT_FOUND when the team does not exist', async () => {
    prismaMock.team.findUnique.mockResolvedValue(null);

    await expect(
      createInternalTeamWebhook({
        enabled: true,
        eventTriggers: ['DOCUMENT_COMPLETED'],
        secret: null,
        teamUrl: 'missing',
        userId: 7,
        webhookUrl: 'https://api.example.com/webhooks/documenso',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });

    expect(prismaMock.webhook.create).not.toHaveBeenCalled();
  });

  it('returns INVALID_REQUEST when the user is not a team member', async () => {
    prismaMock.team.findFirst.mockResolvedValue(null);

    await expect(
      createInternalTeamWebhook({
        enabled: true,
        eventTriggers: ['DOCUMENT_COMPLETED'],
        secret: null,
        teamUrl: 'managed_team',
        userId: 999,
        webhookUrl: 'https://api.example.com/webhooks/documenso',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
    });

    expect(prismaMock.webhook.create).not.toHaveBeenCalled();
  });
});
