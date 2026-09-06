export interface IDatadogRumProxyOptions {
  parameters: string;
  path: string;
  subdomain?: string;
}

export function normalizeDatadogRumProxyUrl(proxyUrl: string): string {
  const trimmed = proxyUrl.replace(/\/$/, '');

  try {
    const url = new URL(trimmed);
    if (url.hostname === '0.0.0.0') {
      url.hostname = 'localhost';
      console.warn('[datadog-rum] RUM proxy URL uses 0.0.0.0, which browsers block. Using http://localhost instead.');
      return url.origin;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function buildObfuscatedProxyUrl(proxyUrl: string, options: IDatadogRumProxyOptions): string {
  const params = new URLSearchParams(options.parameters);
  if (options.subdomain) {
    params.set('ddforwardSubdomain', options.subdomain);
  }
  const target = `${options.path}?${params.toString()}`;
  return `${proxyUrl}/ingest?t=${encodeURIComponent(target)}`;
}

/**
 * Redact recipient signing tokens from URL path segments.
 * Mirrors PostHog sanitization in `apps/remix/app/entry.client.tsx`.
 */
export function redactSigningTokensFromUrl(url: string): string {
  return url.replace(/(\/(?:sign|d|direct)\/)([^/?#]+)/g, '$1:token');
}

export function sanitizeDatadogRumUrl(url: unknown): unknown {
  if (typeof url !== 'string') {
    return url;
  }

  return redactSigningTokensFromUrl(url.replace(/([?&](?:token|access_token|refresh_token)=)[^&]+/gi, '$1[redacted]'));
}
