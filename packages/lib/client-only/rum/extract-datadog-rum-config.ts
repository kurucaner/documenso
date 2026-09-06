import { env } from '@documenso/lib/utils/env';

import type { ICreateDatadogRumOptions } from './types';

export const DEFAULT_DD_RUM_SERVICE = 'documenso-web';

/**
 * Reads Datadog RUM settings from public env vars.
 * Returns null when RUM is not configured (opt-in).
 * Requires application id and client token only; service defaults to {@link DEFAULT_DD_RUM_SERVICE}.
 * When proxy URL is omitted, the browser sends directly to Datadog intake (may be blocked by ad blockers).
 */
export function extractDatadogRumConfig(): ICreateDatadogRumOptions | null {
  const applicationId = env('NEXT_PUBLIC_DD_RUM_APPLICATION_ID');
  const clientToken = env('NEXT_PUBLIC_DD_CLIENT_TOKEN');

  if (!applicationId || !clientToken) {
    return null;
  }

  const ddEnv = env('NEXT_PUBLIC_DD_ENV') ?? 'production';

  if (ddEnv === 'local') {
    return null;
  }

  const proxyUrl = env('NEXT_PUBLIC_DD_RUM_PROXY_URL');
  const service = env('NEXT_PUBLIC_DD_SERVICE') ?? DEFAULT_DD_RUM_SERVICE;

  return {
    applicationId,
    clientToken,
    env: ddEnv,
    ...(proxyUrl ? { proxyUrl } : {}),
    service,
    site: env('NEXT_PUBLIC_DD_SITE'),
  };
}
