import { prisma } from '@documenso/prisma';
import { hash } from '@node-rs/bcrypt';
import type { User } from '@prisma/client';

import { SALT_ROUNDS } from '../../constants/auth';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { createPersonalOrganisation } from '../organisation/create-organisation';

export type PersonalOrganisationOptions = {
  organisationName?: string;
  teamName?: string;
};

export interface CreateUserOptions {
  name: string;
  email: string;
  password: string;
  signature?: string | null;
  emailVerified?: Date | null;
  accountDeletionDisabled?: boolean;
  personalOrganisation?: PersonalOrganisationOptions;
}

export const createUser = async ({
  name,
  email,
  password,
  signature,
  emailVerified,
  accountDeletionDisabled = false,
  personalOrganisation,
}: CreateUserOptions) => {
  const hashedPassword = await hash(password, SALT_ROUNDS);

  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS);
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashedPassword, // Todo: (RR7) Drop password.
      signature,
      emailVerified,
      accountDeletionDisabled,
    },
  });

  await onCreateUserHook(user, { personalOrganisation }).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  return user;
};

export type OnCreateUserHookOptions = {
  /**
   * When true, do not create a "Personal Organisation" for the new user.
   * Used by the Organisation SSO signup path, where the user is intended
   * to operate inside the SSO organisation rather than a personal space.
   *
   * Defaults to false — preserves the historical behaviour of creating a
   * personal organisation for every new user.
   */
  skipPersonalOrganisation?: boolean;
  personalOrganisation?: PersonalOrganisationOptions;
};

/**
 * Should be run after a user is created, example during email password signup or google sign in.
 *
 * @returns User
 */
export const onCreateUserHook = async (user: User, options: OnCreateUserHookOptions = {}) => {
  if (!options.skipPersonalOrganisation) {
    await createPersonalOrganisation({
      userId: user.id,
      organisationName: options.personalOrganisation?.organisationName,
      teamName: options.personalOrganisation?.teamName,
    });
  }

  return user;
};
