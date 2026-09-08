import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';
import { hashBootstrapSessionToken } from './bootstrap-session-token';

const prismaMock = vi.hoisted(() => ({
  bootstrapSessionToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

const { consumeBootstrapSession } = await import('./consume-bootstrap-session');

describe('consume-bootstrap-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it('consumes a valid token and returns the user id', async () => {
    const token = 'bootstrap-token-valid';
    const tokenHash = hashBootstrapSessionToken(token);
    const expiresAt = new Date(Date.now() + 60_000);

    prismaMock.bootstrapSessionToken.findUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt,
      id: 'bootstrap_session_abc123',
      userId: 42,
    });
    prismaMock.user.findFirst.mockResolvedValue({
      disabled: false,
      twoFactorEnabled: false,
    });
    prismaMock.bootstrapSessionToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await consumeBootstrapSession({ token });

    expect(result).toEqual({
      tokenId: 'bootstrap_session_abc123',
      userId: 42,
    });
    expect(prismaMock.bootstrapSessionToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
      select: {
        consumedAt: true,
        expiresAt: true,
        id: true,
        userId: true,
      },
    });
    expect(prismaMock.bootstrapSessionToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid tokens', async () => {
    prismaMock.bootstrapSessionToken.findUnique.mockResolvedValue(null);

    await expect(consumeBootstrapSession({ token: 'missing-token' })).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
    });
    expect(prismaMock.bootstrapSessionToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects already consumed tokens', async () => {
    prismaMock.bootstrapSessionToken.findUnique.mockResolvedValue({
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      id: 'bootstrap_session_used',
      userId: 42,
    });

    await expect(consumeBootstrapSession({ token: 'used-token' })).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
      message: 'Bootstrap session token already used',
    });
    expect(prismaMock.bootstrapSessionToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects expired tokens', async () => {
    prismaMock.bootstrapSessionToken.findUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      id: 'bootstrap_session_expired',
      userId: 42,
    });

    await expect(consumeBootstrapSession({ token: 'expired-token' })).rejects.toMatchObject({
      code: AppErrorCode.EXPIRED_CODE,
      message: 'Bootstrap session token expired',
    });
    expect(prismaMock.bootstrapSessionToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects concurrent reuse when updateMany does not claim the token', async () => {
    prismaMock.bootstrapSessionToken.findUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      id: 'bootstrap_session_race',
      userId: 42,
    });
    prismaMock.user.findFirst.mockResolvedValue({
      disabled: false,
      twoFactorEnabled: false,
    });
    prismaMock.bootstrapSessionToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeBootstrapSession({ token: 'race-token' })).rejects.toMatchObject({
      code: AppErrorCode.INVALID_REQUEST,
      message: 'Bootstrap session token already used',
    });
  });

  it('rejects disabled users at consume time', async () => {
    prismaMock.bootstrapSessionToken.findUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      id: 'bootstrap_session_disabled',
      userId: 42,
    });
    prismaMock.user.findFirst.mockResolvedValue({
      disabled: true,
      twoFactorEnabled: false,
    });

    await expect(consumeBootstrapSession({ token: 'disabled-user-token' })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
    });
    expect(prismaMock.bootstrapSessionToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects users with 2FA enabled at consume time', async () => {
    prismaMock.bootstrapSessionToken.findUnique.mockResolvedValue({
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      id: 'bootstrap_session_2fa',
      userId: 42,
    });
    prismaMock.user.findFirst.mockResolvedValue({
      disabled: false,
      twoFactorEnabled: true,
    });

    await expect(consumeBootstrapSession({ token: '2fa-user-token' })).rejects.toMatchObject({
      code: AppErrorCode.FORBIDDEN,
      statusCode: 403,
    });
    expect(prismaMock.bootstrapSessionToken.updateMany).not.toHaveBeenCalled();
  });
});
