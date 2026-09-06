import { describe, expect, it } from 'vitest';

import { resolveDatadogRumConfig } from './create-datadog-rum';
import { DEFAULT_DD_RUM_SERVICE } from './extract-datadog-rum-config';

describe('resolveDatadogRumConfig', () => {
  it('returns config with proxy when proxyUrl is set', () => {
    expect(
      resolveDatadogRumConfig({
        applicationId: 'app-id',
        clientToken: 'client-token',
        env: 'qa',
        proxyUrl: 'http://localhost:8082',
        service: 'documenso-web',
        site: 'us5.datadoghq.com',
      }),
    ).toEqual({
      applicationId: 'app-id',
      clientToken: 'client-token',
      env: 'qa',
      plugins: undefined,
      proxyUrl: 'http://localhost:8082',
      service: 'documenso-web',
      site: 'us5.datadoghq.com',
      version: undefined,
    });
  });

  it('returns config without proxyUrl for direct Datadog intake', () => {
    expect(
      resolveDatadogRumConfig({
        applicationId: 'app-id',
        clientToken: 'client-token',
        env: 'development',
      }),
    ).toEqual({
      applicationId: 'app-id',
      clientToken: 'client-token',
      env: 'development',
      plugins: undefined,
      proxyUrl: undefined,
      service: DEFAULT_DD_RUM_SERVICE,
      site: 'us5.datadoghq.com',
      version: undefined,
    });
  });

  it('defaults service when omitted', () => {
    expect(
      resolveDatadogRumConfig({
        applicationId: 'app-id',
        clientToken: 'client-token',
      })?.service,
    ).toBe(DEFAULT_DD_RUM_SERVICE);
  });

  it('returns null when application id or client token is missing', () => {
    expect(resolveDatadogRumConfig({ clientToken: 'token' })).toBeNull();
    expect(resolveDatadogRumConfig({ applicationId: 'app-id' })).toBeNull();
  });

  it('returns null when env is local', () => {
    expect(
      resolveDatadogRumConfig({
        applicationId: 'app-id',
        clientToken: 'client-token',
        env: 'local',
      }),
    ).toBeNull();
  });
});
