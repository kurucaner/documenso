import { afterEach, describe, expect, it } from 'vitest';

import { extractDatadogRumConfig } from './extract-datadog-rum-config';

const ENV_KEYS = [
  'NEXT_PUBLIC_DD_RUM_APPLICATION_ID',
  'NEXT_PUBLIC_DD_CLIENT_TOKEN',
  'NEXT_PUBLIC_DD_RUM_PROXY_URL',
  'NEXT_PUBLIC_DD_SERVICE',
  'NEXT_PUBLIC_DD_ENV',
  'NEXT_PUBLIC_DD_SITE',
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('extractDatadogRumConfig', () => {
  it('returns config when all required env vars are set', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    process.env.NEXT_PUBLIC_DD_RUM_PROXY_URL = 'http://localhost:8082';
    process.env.NEXT_PUBLIC_DD_SERVICE = 'documenso-web';
    process.env.NEXT_PUBLIC_DD_ENV = 'qa';
    process.env.NEXT_PUBLIC_DD_SITE = 'us5.datadoghq.com';

    expect(extractDatadogRumConfig()).toEqual({
      applicationId: 'app-id',
      clientToken: 'client-token',
      env: 'qa',
      proxyUrl: 'http://localhost:8082',
      service: 'documenso-web',
      site: 'us5.datadoghq.com',
    });
  });

  it('defaults env to production when NEXT_PUBLIC_DD_ENV is omitted', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    process.env.NEXT_PUBLIC_DD_RUM_PROXY_URL = 'http://localhost:8082';
    process.env.NEXT_PUBLIC_DD_SERVICE = 'documenso-web';
    delete process.env.NEXT_PUBLIC_DD_ENV;

    expect(extractDatadogRumConfig()?.env).toBe('production');
  });

  it('returns null when any required env var is missing', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    process.env.NEXT_PUBLIC_DD_RUM_PROXY_URL = 'http://localhost:8082';
    delete process.env.NEXT_PUBLIC_DD_SERVICE;

    expect(extractDatadogRumConfig()).toBeNull();
  });

  it('returns null when env is local', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    process.env.NEXT_PUBLIC_DD_RUM_PROXY_URL = 'http://localhost:8082';
    process.env.NEXT_PUBLIC_DD_SERVICE = 'documenso-web';
    process.env.NEXT_PUBLIC_DD_ENV = 'local';

    expect(extractDatadogRumConfig()).toBeNull();
  });
});
