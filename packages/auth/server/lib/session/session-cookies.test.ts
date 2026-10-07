import { parseSigned } from 'hono/utils/cookie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('buildSessionSetCookieHeader', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-auth-secret-for-session-cookies';
    process.env.NEXT_PUBLIC_WEBAPP_URL = 'https://sign.example.com';
    process.env.NODE_ENV = 'production';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('produces a signed session cookie verifiable with the auth secret', async () => {
    const { buildSessionSetCookieHeader, sessionCookieName } = await import('./session-cookies');

    const sessionToken = 'session-token-for-bootstrap-test';
    const setCookieHeader = await buildSessionSetCookieHeader(sessionToken);

    expect(setCookieHeader).toContain(`${sessionCookieName}=`);
    expect(setCookieHeader.toLowerCase()).toContain('httponly');
    expect(setCookieHeader.toLowerCase()).toContain('secure');

    const parsed = await parseSigned(setCookieHeader, process.env.NEXTAUTH_SECRET!, sessionCookieName);
    expect(parsed[sessionCookieName]).toBe(sessionToken);
  });
});
