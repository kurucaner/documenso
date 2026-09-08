import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError } from '@documenso/lib/errors/app-error';
import { consumeBootstrapSession } from '@documenso/lib/server-only/internal-api/consume-bootstrap-session';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';
import { getContext } from 'hono/context-storage';
import { redirect } from 'react-router';
import type { HonoEnv } from 'server/router';
import { establishBootstrapSession } from 'server/utils/establish-bootstrap-session';

import type { Route } from './+types/signin.bootstrap';

const BOOTSTRAP_SIGN_IN_ERROR = 'bootstrap_expired';

function resolveReturnTo(request: Request): string {
  const url = new URL(request.url);
  const returnToParam = url.searchParams.get('returnTo') ?? undefined;

  if (isValidReturnTo(returnToParam)) {
    return normalizeReturnTo(returnToParam) ?? '/';
  }

  return '/';
}

function redirectBootstrapExpired(): never {
  throw redirect(`/signin?error=${BOOTSTRAP_SIGN_IN_ERROR}`);
}

export async function loader({ request }: Route.LoaderArgs) {
  const returnTo = resolveReturnTo(request);
  const { isAuthenticated } = await getOptionalSession(request);

  if (isAuthenticated) {
    throw redirect(returnTo);
  }

  const token = new URL(request.url).searchParams.get('token')?.trim();
  const { logger } = getContext<HonoEnv>().var;

  if (!token) {
    logger.info({
      eventType: 'documenso.bootstrap_session.rejected',
      reason: 'missing_token',
    });
    redirectBootstrapExpired();
  }

  try {
    const { tokenId, userId } = await consumeBootstrapSession({ token: token! });

    await establishBootstrapSession(userId, request);

    logger.info({
      eventType: 'documenso.bootstrap_session.consumed',
      tokenId,
      userId,
    });

    throw redirect(returnTo);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    const appError = AppError.parseError(error);

    logger.info({
      eventType: 'documenso.bootstrap_session.rejected',
      reason: appError.code,
      statusCode: appError.statusCode,
    });

    redirectBootstrapExpired();
  }
}

export default function SignInBootstrapRoute() {
  return null;
}
