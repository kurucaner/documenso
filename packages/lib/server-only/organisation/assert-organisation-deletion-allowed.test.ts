import { describe, expect, it } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { assertOrganisationDeletionAllowed } from './assert-organisation-deletion-allowed';

describe('assertOrganisationDeletionAllowed', () => {
  it('passes when the organisation is not integration-managed', () => {
    expect(() =>
      assertOrganisationDeletionAllowed({
        isManaged: false,
      }),
    ).not.toThrow();
  });

  it('throws FORBIDDEN when the organisation is integration-managed', () => {
    try {
      assertOrganisationDeletionAllowed({
        isManaged: true,
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(AppErrorCode.FORBIDDEN);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).message).toBe('Organisation deletion is managed by PropertyOS');
    }
  });
});
