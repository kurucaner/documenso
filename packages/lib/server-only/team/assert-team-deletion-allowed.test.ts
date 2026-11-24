import { describe, expect, it } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { assertTeamDeletionAllowed } from './assert-team-deletion-allowed';

describe('assertTeamDeletionAllowed', () => {
  it('passes when the organisation is not integration-managed', () => {
    expect(() => assertTeamDeletionAllowed({ organisationIsManaged: false })).not.toThrow();
  });

  it('throws FORBIDDEN when the organisation is integration-managed', () => {
    try {
      assertTeamDeletionAllowed({ organisationIsManaged: true });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(AppErrorCode.FORBIDDEN);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).message).toBe('Team deletion is managed by PropertyOS');
    }
  });
});
