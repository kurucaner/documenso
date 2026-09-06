import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_DD_RUM_SERVICE, extractDatadogRumConfig } from './extract-datadog-rum-config';

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
  it('returns config when application id and client token are set', () => {
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

  it('omits proxyUrl for direct intake when NEXT_PUBLIC_DD_RUM_PROXY_URL is unset', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    delete process.env.NEXT_PUBLIC_DD_RUM_PROXY_URL;
    delete process.env.NEXT_PUBLIC_DD_SERVICE;

    expect(extractDatadogRumConfig()).toEqual({
      applicationId: 'app-id',
      clientToken: 'client-token',
      env: 'production',
      service: DEFAULT_DD_RUM_SERVICE,
      site: undefined,
    });
  });

  it('defaults service to documenso-web when NEXT_PUBLIC_DD_SERVICE is omitted', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';

    expect(extractDatadogRumConfig()?.service).toBe(DEFAULT_DD_RUM_SERVICE);
  });

  it('defaults env to production when NEXT_PUBLIC_DD_ENV is omitted', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    delete process.env.NEXT_PUBLIC_DD_ENV;

    expect(extractDatadogRumConfig()?.env).toBe('production');
  });

  it('returns null when application id or client token is missing', () => {
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    delete process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID;

    expect(extractDatadogRumConfig()).toBeNull();

    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    delete process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN;

    expect(extractDatadogRumConfig()).toBeNull();
  });

  it('returns null when env is local', () => {
    process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID = 'app-id';
    process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN = 'client-token';
    process.env.NEXT_PUBLIC_DD_ENV = 'local';

    expect(extractDatadogRumConfig()).toBeNull();
  });
});
