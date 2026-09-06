import { describe, expect, it } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { assertAccountDeletionAllowed } from './assert-account-deletion-allowed';

describe('assertAccountDeletionAllowed', () => {
  it('passes when account deletion is allowed', () => {
    expect(() => assertAccountDeletionAllowed({ accountDeletionDisabled: false })).not.toThrow();
  });

  it('throws FORBIDDEN when account deletion is disabled', () => {
    try {
      assertAccountDeletionAllowed({ accountDeletionDisabled: true });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(AppErrorCode.FORBIDDEN);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).message).toBe('Account deletion is disabled for this account');
    }
  });
});
