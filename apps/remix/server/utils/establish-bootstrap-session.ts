import { createSession, generateSessionToken } from '@documenso/auth/server/lib/session/session';
import { buildSessionSetCookieHeader } from '@documenso/auth/server/lib/session/session-cookies';
import { assertUserNotDisabledById } from '@documenso/lib/server-only/user/assert-user-not-disabled';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

export type TEstablishBootstrapSessionForRedirectResult = {
  sessionToken: string;
  setCookieHeader: string;
};

export async function establishBootstrapSessionForRedirect(
  userId: number,
  request: Request,
): Promise<TEstablishBootstrapSessionForRedirectResult> {
  await assertUserNotDisabledById({ userId });

  const metadata = extractRequestMetadata(request);
  const sessionToken = generateSessionToken();

  await createSession(sessionToken, userId, metadata);
  const setCookieHeader = await buildSessionSetCookieHeader(sessionToken);

  return {
    sessionToken,
    setCookieHeader,
  };
}

/** @deprecated Use {@link establishBootstrapSessionForRedirect} — Hono context cookies are not merged onto React Router redirect responses. */
export const establishBootstrapSession = establishBootstrapSessionForRedirect;
