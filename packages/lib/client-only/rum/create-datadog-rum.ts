import { datadogRum } from '@datadog/browser-rum';

import { buildObfuscatedProxyUrl, normalizeDatadogRumProxyUrl, sanitizeDatadogRumUrl } from './datadog-rum-proxy-url';
import { DEFAULT_DD_RUM_SERVICE } from './extract-datadog-rum-config';
import type { ICreateDatadogRumOptions, IDatadogRumClient, IDatadogRumConfig, IDatadogRumUser } from './types';

const DEFAULT_DD_SITE = 'us5.datadoghq.com';

export function resolveDatadogRumConfig(options: ICreateDatadogRumOptions): IDatadogRumConfig | null {
  const { applicationId, clientToken, proxyUrl } = options;

  if (!applicationId || !clientToken || options.env === 'local') {
    return null;
  }

  const normalizedProxyUrl = proxyUrl?.trim() ? normalizeDatadogRumProxyUrl(proxyUrl) : undefined;

  return {
    applicationId,
    clientToken,
    env: options.env ?? 'production',
    plugins: options.plugins,
    proxyUrl: normalizedProxyUrl,
    service: options.service?.trim() || DEFAULT_DD_RUM_SERVICE,
    site: options.site ?? DEFAULT_DD_SITE,
    version: options.version,
  };
}

export function createDatadogRum(options: ICreateDatadogRumOptions): IDatadogRumClient {
  let rumInitialized = false;
  const config = resolveDatadogRumConfig(options);

  const init = (): void => {
    if (rumInitialized || globalThis.window === undefined || !config) {
      return;
    }

    datadogRum.init({
      applicationId: config.applicationId,
      beforeSend: (event) => {
        const view = event.view as { url?: string } | undefined;
        const resource = event.resource as { url?: string } | undefined;

        if (typeof view?.url === 'string') {
          view.url = sanitizeDatadogRumUrl(view.url) as string;
        }
        if (typeof resource?.url === 'string') {
          resource.url = sanitizeDatadogRumUrl(resource.url) as string;
        }

        return true;
      },
      clientToken: config.clientToken,
      defaultPrivacyLevel: 'mask-user-input',
      env: config.env,
      plugins: config.plugins,
      ...(config.proxyUrl
        ? {
            proxy: (proxyOptions: { parameters: string; path: string; subdomain?: string }) =>
              buildObfuscatedProxyUrl(config.proxyUrl!, proxyOptions),
          }
        : {}),
      service: config.service,
      sessionReplaySampleRate: 0,
      sessionSampleRate: 100,
      site: config.site,
      startSessionReplayRecordingManually: false,
      trackLongTasks: true,
      trackResources: true,
      trackUserInteractions: true,
      version: config.version,
    });

    rumInitialized = true;
  };

  const isEnabled = (): boolean => rumInitialized;

  const setUser = (user: IDatadogRumUser): void => {
    if (!rumInitialized) {
      return;
    }

    datadogRum.setUser({
      email: user.email,
      id: user.id,
      name: user.name,
    });
  };

  const clearUser = (): void => {
    if (!rumInitialized) {
      return;
    }

    datadogRum.clearUser();
  };

  const trackView = (name: string): void => {
    if (!rumInitialized) {
      return;
    }

    datadogRum.startView({ name });
  };

  const trackError = (error: unknown, context?: Record<string, unknown>): void => {
    if (!rumInitialized) {
      return;
    }

    if (error instanceof Error) {
      datadogRum.addError(error, context);
      return;
    }

    datadogRum.addError(typeof error === 'string' ? error : JSON.stringify(error), context);
  };

  return {
    clearUser,
    init,
    isEnabled,
    setUser,
    trackError,
    trackView,
  };
}
