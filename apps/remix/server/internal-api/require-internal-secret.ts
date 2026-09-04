import { AppError } from '@documenso/lib/errors/app-error';
import { requireInternalSecret as assertInternalSecret } from '@documenso/lib/server-only/internal-api/require-internal-secret';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const requireInternalSecret = (authorizationHeader: string | null | undefined): void => {
  try {
    assertInternalSecret(authorizationHeader);
  } catch (error) {
    const appError = AppError.parseError(error);

    throw new HTTPException((appError.statusCode ?? 401) as ContentfulStatusCode, {
      message: appError.message,
    });
  }
};
