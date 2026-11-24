import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';

const createUserMock = vi.hoisted(() => vi.fn());

vi.mock('../user/create-user', () => ({
  createUser: createUserMock,
}));

const prismaMock = vi.hoisted(() => ({
  organisation: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('./is-internal-secret-configured', () => ({
  isInternalSecretConfigured: vi.fn(() => true),
}));

vi.mock('../signup-invite/get-signup-invite-by-token', () => ({
  normalizeSignupInviteEmail: (email: string) => email.toLowerCase(),
}));

vi.mock('../site-settings/get-email-blocklist-domains', () => ({
  getEmailBlocklistDomains: vi.fn(async () => []),
}));

vi.mock('../../constants/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../constants/auth')>();
  return {
    ...actual,
    isDisposableEmail: () => false,
  };
});

const { provisionInternalUser } = await import('./provision-internal-user');

describe('provisionInternalUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createUserMock.mockResolvedValue({
      email: 'user@example.com',
      id: 42,
    });
  });

  it('creates org only when skipInitialTeam is true', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({
      teams: [],
      url: 'org_test',
    });

    const result = await provisionInternalUser({
      email: 'user@example.com',
      name: 'User',
      password: 'Password123#',
      signature: 'User',
      skipInitialTeam: true,
    });

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        personalOrganisation: expect.objectContaining({
          skipInitialTeam: true,
          isManagedOrganisation: true,
        }),
      }),
    );
    expect(result).toEqual({
      email: 'user@example.com',
      orgUrl: 'org_test',
      userId: 42,
    });
    expect(result.teamUrl).toBeUndefined();
  });

  it('returns teamUrl when skipInitialTeam is false', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue({
      teams: [{ url: 'personal_team' }],
      url: 'org_test',
    });

    const result = await provisionInternalUser({
      email: 'user@example.com',
      name: 'User',
      password: 'Password123#',
      signature: 'User',
    });

    expect(result.teamUrl).toBe('personal_team');
    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        personalOrganisation: expect.objectContaining({
          skipInitialTeam: false,
        }),
      }),
    );
  });

  it('throws when org is missing after create', async () => {
    prismaMock.organisation.findFirst.mockResolvedValue(null);

    await expect(
      provisionInternalUser({
        email: 'user@example.com',
        name: 'User',
        password: 'Password123#',
        signature: 'User',
        skipInitialTeam: true,
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.UNKNOWN_ERROR,
    });
  });
});
