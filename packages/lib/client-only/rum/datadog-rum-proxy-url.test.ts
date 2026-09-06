import { describe, expect, it } from 'vitest';

import {
  buildObfuscatedProxyUrl,
  normalizeDatadogRumProxyUrl,
  redactSigningTokensFromUrl,
  sanitizeDatadogRumUrl,
} from './datadog-rum-proxy-url';

describe('buildObfuscatedProxyUrl', () => {
  it('builds a neutral ingest URL with encoded Datadog target', () => {
    const url = buildObfuscatedProxyUrl('https://documenso-proxy.example.com', {
      parameters: 'ddsource=browser&dd-api-key=pub123',
      path: '/api/v2/rum',
    });

    expect(url.startsWith('https://documenso-proxy.example.com/ingest?t=')).toBe(true);
    expect(url).not.toContain('/rum?ddsource=');
    expect(url).not.toContain('dd-api-key=');
  });

  it('includes ddforwardSubdomain in encoded target', () => {
    const url = buildObfuscatedProxyUrl('https://documenso-proxy.example.com', {
      parameters: 'ddsource=browser',
      path: '/api/v2/rum',
      subdomain: 'session',
    });

    const encodedTarget = new URL(url).searchParams.get('t');
    expect(encodedTarget).toContain('ddforwardSubdomain=session');
  });
});

describe('normalizeDatadogRumProxyUrl', () => {
  it('strips a trailing slash', () => {
    expect(normalizeDatadogRumProxyUrl('https://proxy.example/')).toBe('https://proxy.example');
  });

  it('rewrites 0.0.0.0 to localhost origin', () => {
    expect(normalizeDatadogRumProxyUrl('http://0.0.0.0:8082')).toBe('http://localhost:8082');
  });

  it('returns invalid URLs trimmed', () => {
    expect(normalizeDatadogRumProxyUrl('/relative-proxy/')).toBe('/relative-proxy');
  });
});

describe('redactSigningTokensFromUrl', () => {
  it('redacts signing route path tokens', () => {
    expect(redactSigningTokensFromUrl('https://sign.example.com/sign/abc123token?foo=bar')).toBe(
      'https://sign.example.com/sign/:token?foo=bar',
    );
    expect(redactSigningTokensFromUrl('https://sign.example.com/d/secret-slug')).toBe(
      'https://sign.example.com/d/:token',
    );
    expect(redactSigningTokensFromUrl('https://sign.example.com/direct/another-token')).toBe(
      'https://sign.example.com/direct/:token',
    );
  });
});

describe('sanitizeDatadogRumUrl', () => {
  it('redacts token query params', () => {
    expect(sanitizeDatadogRumUrl('https://app.example/invite?token=secret&next=/home')).toBe(
      'https://app.example/invite?token=[redacted]&next=/home',
    );
  });

  it('redacts signing path tokens and query params together', () => {
    expect(sanitizeDatadogRumUrl('https://app.example/sign/abc123?token=secret')).toBe(
      'https://app.example/sign/:token?token=[redacted]',
    );
  });

  it('returns non-strings unchanged', () => {
    expect(sanitizeDatadogRumUrl(undefined)).toBeUndefined();
  });
});
