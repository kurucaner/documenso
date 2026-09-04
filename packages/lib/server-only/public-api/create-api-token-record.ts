import { prisma } from '@documenso/prisma';
import type { Duration } from 'luxon';
import { DateTime } from 'luxon';

import * as timeConstants from '../../constants/time';
import { alphaid } from '../../universal/id';
import { hashString } from '../auth/hash';

type TimeConstants = typeof timeConstants & {
  [key: string]: number | Duration;
};

export type CreateApiTokenRecordOptions = {
  teamId: number;
  tokenName: string;
  expiresIn: string | null;
  userId?: number | null;
};

export type CreateApiTokenRecordResult = {
  id: number;
  token: string;
  expiresAt: Date | null;
};

export const createApiTokenRecord = async ({
  teamId,
  tokenName,
  expiresIn,
  userId = null,
}: CreateApiTokenRecordOptions): Promise<CreateApiTokenRecordResult> => {
  const apiToken = `api_${alphaid(16)}`;
  const hashedToken = hashString(apiToken);
  const timeConstantsRecords: TimeConstants = timeConstants;

  const expiresAt = expiresIn ? DateTime.now().plus(timeConstantsRecords[expiresIn]).toJSDate() : null;

  const storedToken = await prisma.apiToken.create({
    data: {
      name: tokenName,
      token: hashedToken,
      expires: expiresAt,
      userId,
      teamId,
    },
  });

  return {
    id: storedToken.id,
    token: apiToken,
    expiresAt: storedToken.expires,
  };
};
