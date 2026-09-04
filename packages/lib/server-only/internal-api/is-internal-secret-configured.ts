import { env } from '@documenso/lib/utils/env';

export const isInternalSecretConfigured = (): boolean => {
  const secret = env('NEXT_PRIVATE_INTERNAL_SECRET');

  return typeof secret === 'string' && secret.length > 0;
};

export const getInternalSecret = (): string | null => {
  const secret = env('NEXT_PRIVATE_INTERNAL_SECRET');

  if (!secret) {
    return null;
  }

  return secret;
};
