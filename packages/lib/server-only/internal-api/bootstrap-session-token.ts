import crypto from 'node:crypto';

export const BOOTSTRAP_SESSION_PATH = '/signin/bootstrap';

export const BOOTSTRAP_SESSION_TTL_MS = 5 * 60 * 1000;

export const generateBootstrapSessionToken = (): string => {
  return crypto.randomBytes(32).toString('base64url');
};

export const hashBootstrapSessionToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
