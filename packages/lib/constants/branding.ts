import { env } from '@documenso/lib/utils/env';

/**
 * Maximum length (in characters) of the user-supplied custom CSS for branding.
 * Bound enforced at the TRPC request boundary on both the organisation and
 * team settings update routes. The sanitiser is run after this check; this
 * limit is purely a request-size guard.
 *
 * 256 KB — generous enough for hand-written branding CSS and the occasional
 * compiled-from-Tailwind-or-similar paste, while still keeping a request
 * cap so a malicious or runaway payload can't exhaust PostCSS/server memory.
 */
export const BRANDING_CSS_MAX_LENGTH = 256 * 1024;

/**
 * Branding logo upload constraints. Enforced server-side at the TRPC request
 * boundary (`zfdBrandingImageFile`) and reused by the client form for matching UX.
 */
export const BRANDING_LOGO_MAX_SIZE_MB = 5;

export const BRANDING_LOGO_MAX_SIZE_BYTES = BRANDING_LOGO_MAX_SIZE_MB * 1024 * 1024;

export const BRANDING_LOGO_ALLOWED_TYPES: string[] = ['image/jpeg', 'image/png', 'image/webp'];

export const DEFAULT_APP_NAME = 'Documenso';

export const APP_NAME = (): string => {
  const value = env('NEXT_PUBLIC_APP_NAME')?.trim();

  if (value) {
    return value;
  }

  return DEFAULT_APP_NAME;
};

export const APP_COMPANY_NAME = (): string => {
  const value = env('NEXT_PUBLIC_APP_COMPANY_NAME')?.trim();

  if (value) {
    return value;
  }

  return `${APP_NAME()}, Inc.`;
};

export const APP_DESCRIPTION = (): string => {
  const value = env('NEXT_PUBLIC_APP_DESCRIPTION')?.trim();

  if (value) {
    return value;
  }

  return `Sign and manage documents with ${APP_NAME()}.`;
};

export const APP_LOGO_URL = (): string | undefined => {
  const value = env('NEXT_PUBLIC_APP_LOGO_URL')?.trim();

  if (!value) {
    return undefined;
  }

  return value;
};

export const APP_FAVICON_URL = (): string | undefined => {
  const value = env('NEXT_PUBLIC_APP_FAVICON_URL')?.trim();

  if (!value) {
    return undefined;
  }

  return value;
};

export const APP_HIDE_POWERED_BY = (): boolean => {
  return env('NEXT_PUBLIC_APP_HIDE_POWERED_BY') === 'true';
};

export const APP_ATTRIBUTION_URL = (): string => {
  const value = env('NEXT_PUBLIC_APP_ATTRIBUTION_URL')?.trim();

  if (value) {
    return value;
  }

  return 'https://documen.so/mail-footer';
};

export const getAppLogoUrl = (assetBaseUrl: string): string => {
  const customLogoUrl = APP_LOGO_URL();

  if (!customLogoUrl) {
    return new URL('/static/logo.png', assetBaseUrl).toString();
  }

  if (customLogoUrl.startsWith('http://') || customLogoUrl.startsWith('https://')) {
    return customLogoUrl;
  }

  return new URL(customLogoUrl, assetBaseUrl).toString();
};

export const formatPageTitle = (pageTitle?: string): string => {
  const appName = APP_NAME();

  if (!pageTitle) {
    return appName;
  }

  return `${pageTitle} - ${appName}`;
};
