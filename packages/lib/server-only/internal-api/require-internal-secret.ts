import { AppError, AppErrorCode } from '../../errors/app-error';

import { isInternalSecretConfigured } from './is-internal-secret-configured';
import { verifyInternalSecret } from './verify-internal-secret';

export const requireInternalSecret = (authorizationHeader: string | null | undefined): void => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API is not configured',
      statusCode: 503,
    });
  }

  if (!verifyInternalSecret(authorizationHeader)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Unauthorized',
    });
  }
};
