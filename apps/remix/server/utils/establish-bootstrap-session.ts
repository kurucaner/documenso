import { createSession, generateSessionToken } from '@documenso/auth/server/lib/session/session';
import { setSessionCookie } from '@documenso/auth/server/lib/session/session-cookies';
import { assertUserNotDisabledById } from '@documenso/lib/server-only/user/assert-user-not-disabled';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getContext } from 'hono/context-storage';

import type { HonoEnv } from '../router';

export const establishBootstrapSession = async (userId: number, request: Request): Promise<void> => {
  await assertUserNotDisabledById({ userId });

  const metadata = extractRequestMetadata(request);
  const sessionToken = generateSessionToken();

  await createSession(sessionToken, userId, metadata);
  await setSessionCookie(getContext<HonoEnv>(), sessionToken);
};
