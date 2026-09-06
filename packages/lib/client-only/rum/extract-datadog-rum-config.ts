import { env } from '@documenso/lib/utils/env';

import type { ICreateDatadogRumOptions } from './types';

/**
 * Reads Datadog RUM settings from public env vars.
 * Returns null when RUM is not fully configured (opt-in).
 */
export function extractDatadogRumConfig(): ICreateDatadogRumOptions | null {
  const applicationId = env('NEXT_PUBLIC_DD_RUM_APPLICATION_ID');
  const clientToken = env('NEXT_PUBLIC_DD_CLIENT_TOKEN');
  const proxyUrl = env('NEXT_PUBLIC_DD_RUM_PROXY_URL');
  const service = env('NEXT_PUBLIC_DD_SERVICE');

  if (!applicationId || !clientToken || !proxyUrl || !service) {
    return null;
  }

  const ddEnv = env('NEXT_PUBLIC_DD_ENV') ?? 'production';

  if (ddEnv === 'local') {
    return null;
  }

  return {
    applicationId,
    clientToken,
    env: ddEnv,
    proxyUrl,
    service,
    site: env('NEXT_PUBLIC_DD_SITE'),
  };
}
