import { prisma } from '@documenso/prisma';
import { OrganisationType } from '@prisma/client';
import { isDisposableEmail } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { normalizeSignupInviteEmail } from '../signup-invite/get-signup-invite-by-token';
import { getEmailBlocklistDomains } from '../site-settings/get-email-blocklist-domains';
import { createUser } from '../user/create-user';
import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type ProvisionInternalUserOptions = {
  name: string;
  email: string;
  password: string;
  signature: string;
  organisationName?: string;
  teamName?: string;
  disableAccountDeletion?: boolean;
};

export type ProvisionInternalUserResult = {
  userId: number;
  email: string;
  orgUrl: string;
  teamUrl: string;
};

export const provisionInternalUser = async ({
  name,
  email,
  password,
  signature,
  organisationName,
  teamName,
  disableAccountDeletion = false,
}: ProvisionInternalUserOptions): Promise<ProvisionInternalUserResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const normalizedEmail = normalizeSignupInviteEmail(email);

  const additionalBlockedDomains = await getEmailBlocklistDomains();

  if (isDisposableEmail(normalizedEmail, additionalBlockedDomains)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Disposable email addresses are not allowed',
    });
  }

  const user = await createUser({
    name,
    email: normalizedEmail,
    password,
    signature,
    emailVerified: new Date(),
    accountDeletionDisabled: disableAccountDeletion,
    personalOrganisation: {
      organisationName,
      teamName,
    },
  });

  const personalOrganisation = await prisma.organisation.findFirst({
    where: {
      ownerUserId: user.id,
      type: OrganisationType.PERSONAL,
    },
    select: {
      url: true,
      teams: {
        select: {
          url: true,
        },
        take: 1,
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  const teamUrl = personalOrganisation?.teams[0]?.url;

  if (!personalOrganisation?.url || !teamUrl) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to resolve personal organisation after user creation',
    });
  }

  return {
    userId: user.id,
    email: user.email,
    orgUrl: personalOrganisation.url,
    teamUrl,
  };
};
