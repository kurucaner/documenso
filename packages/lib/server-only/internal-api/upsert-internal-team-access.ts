import crypto from 'node:crypto';

import {
  assertMemberCountWithinCap,
  syncMemberCountWithStripeSeatPlan,
} from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { addUserToOrganisation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';
import { normalizeSignupInviteEmail } from '@documenso/lib/server-only/signup-invite/get-signup-invite-by-token';
import { addTeamMembersInternal } from '@documenso/lib/server-only/team/add-team-members-internal';
import { removeTeamMemberInternal } from '@documenso/lib/server-only/team/remove-team-member-internal';
import { createUser } from '@documenso/lib/server-only/user/create-user';
import { prisma } from '@documenso/prisma';
import { type OrganisationMemberRole, SubscriptionStatus, type TeamMemberRole } from '@prisma/client';

import { isInternalSecretConfigured } from './is-internal-secret-configured';

export type UpsertInternalTeamAccessOptions = {
  disableAccountDeletion?: boolean;
  email: string;
  name?: string;
  orgUrl: string;
  organisationMemberRole: OrganisationMemberRole;
  provisionIfMissing?: boolean;
  teamMemberRole: TeamMemberRole;
  teamUrl: string;
};

export type UpsertInternalTeamAccessResult = {
  organisationMemberId: string;
  status: 'active';
  userId: number;
};

const INTERNAL_PROVISION_PASSWORD_BYTES = 24;

const generateInternalProvisionPassword = (): string => {
  return crypto.randomBytes(INTERNAL_PROVISION_PASSWORD_BYTES).toString('base64url');
};

const resolveDisplayName = (email: string, name?: string): string => {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }

  const localPart = email.split('@')[0]?.trim();
  return localPart && localPart.length > 0 ? localPart : email;
};

const assertBillingAllowsNewMember = async (organisation: {
  id: string;
  members: { id: string }[];
  organisationClaim: { teamCount: number };
  subscription: { status: SubscriptionStatus } | null;
}): Promise<void> => {
  if (!IS_BILLING_ENABLED()) {
    return;
  }

  const newMemberCount = organisation.members.length + 1;
  const { subscription, organisationClaim } = organisation;

  if (subscription && subscription.status === SubscriptionStatus.INACTIVE) {
    throw new AppError('SUBSCRIPTION_INACTIVE', {
      message: 'The organisation subscription is inactive',
    });
  }

  await assertMemberCountWithinCap(subscription, organisationClaim, newMemberCount);

  if (subscription) {
    await syncMemberCountWithStripeSeatPlan(subscription, organisationClaim, newMemberCount, 'grow');
  }
};

export const upsertInternalTeamAccess = async (
  options: UpsertInternalTeamAccessOptions,
): Promise<UpsertInternalTeamAccessResult> => {
  if (!isInternalSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Internal API secret is not configured',
      statusCode: 503,
    });
  }

  const normalizedEmail = normalizeSignupInviteEmail(options.email);
  const displayName = resolveDisplayName(normalizedEmail, options.name);

  const organisation = await prisma.organisation.findUnique({
    where: {
      url: options.orgUrl,
    },
    include: {
      groups: true,
      members: {
        select: {
          id: true,
        },
      },
      organisationClaim: true,
      subscription: true,
      teams: {
        where: {
          url: options.teamUrl,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const team = organisation.teams[0];

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  let user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    if (!options.provisionIfMissing) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User not found',
      });
    }

    user = await createUser({
      accountDeletionDisabled: options.disableAccountDeletion ?? true,
      email: normalizedEmail,
      emailVerified: new Date(),
      name: displayName,
      password: generateInternalProvisionPassword(),
      signature: displayName,
      skipPersonalOrganisation: true,
    });
  }

  let organisationMember = await prisma.organisationMember.findFirst({
    where: {
      organisationId: organisation.id,
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!organisationMember) {
    await assertBillingAllowsNewMember(organisation);

    await addUserToOrganisation({
      bypassEmail: true,
      organisationGroups: organisation.groups,
      organisationId: organisation.id,
      organisationMemberRole: options.organisationMemberRole,
      userId: user.id,
    });

    organisationMember = await prisma.organisationMember.findFirstOrThrow({
      where: {
        organisationId: organisation.id,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });
  }

  await removeTeamMemberInternal({
    organisationMemberId: organisationMember.id,
    teamId: team.id,
  });

  await addTeamMembersInternal({
    membersToCreate: [
      {
        organisationMemberId: organisationMember.id,
        teamRole: options.teamMemberRole,
      },
    ],
    teamId: team.id,
  });

  return {
    organisationMemberId: organisationMember.id,
    status: 'active',
    userId: user.id,
  };
};
