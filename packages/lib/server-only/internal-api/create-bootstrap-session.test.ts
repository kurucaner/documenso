import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { hashBootstrapSessionToken } from './bootstrap-session-token';

const prismaMock = vi.hoisted(() => ({
  bootstrapSessionToken: {
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const { createBootstrapSession } = await import('./create-bootstrap-session');

describe('create-bootstrap-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mints a bootstrap token for an eligible user', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      disabled: false,
      twoFactorEnabled: false,
    });
    prismaMock.bootstrapSessionToken.create.mockResolvedValue({});

    const result = await createBootstrapSession({ userId: 42 });

    expect(result.bootstrapPath).toBe('/signin/bootstrap');
    expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());

    expect(prismaMock.bootstrapSessionToken.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.bootstrapSessionToken.create.mock.calls[0]?.[0];
    expect(createArgs.data.userId).toBe(42);
    expect(createArgs.data.tokenHash).toBe(hashBootstrapSessionToken(result.token));
    expect(createArgs.data.tokenHash).not.toBe(result.token);
    expect(createArgs.data.id).toMatch(/^bootstrap_session_/);
    expect(createArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(createArgs.data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 1000);
  });

  it('rejects unknown users with NOT_FOUND', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(createBootstrapSession({ userId: 999 })).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
      statusCode: 404,
    });
    expect(prismaMock.bootstrapSessionToken.create).not.toHaveBeenCalled();
  });

  it('rejects disabled users with FORBIDDEN', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      disabled: true,
      twoFactorEnabled: false,
    });

    await expect(createBootstrapSession({ userId: 42 })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
    });
    expect(prismaMock.bootstrapSessionToken.create).not.toHaveBeenCalled();
  });

  it('rejects users with 2FA enabled with FORBIDDEN', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      disabled: false,
      twoFactorEnabled: true,
    });

    await expect(createBootstrapSession({ userId: 42 })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
    });
    expect(prismaMock.bootstrapSessionToken.create).not.toHaveBeenCalled();
  });
});
