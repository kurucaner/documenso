import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { getTeamById } from '../team/get-team';
import { type DuplicateEnvelopeOptions, duplicateEnvelope } from './duplicate-envelope';

export type CopyTemplateToTeamOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  contextTeamId: number;
  targetTeamId: number;
  requestMetadata: ApiRequestMetadata;
  overrides?: DuplicateEnvelopeOptions['overrides'];
};

export const copyTemplateToTeam = async ({
  id,
  userId,
  contextTeamId,
  targetTeamId,
  requestMetadata,
  overrides,
}: CopyTemplateToTeamOptions) => {
  if (contextTeamId === targetTeamId) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Target team must be different from the current team',
    });
  }

  const [contextTeam, targetTeam] = await Promise.all([
    getTeamById({ userId, teamId: contextTeamId }),
    getTeamById({ userId, teamId: targetTeamId }),
  ]);

  if (contextTeam.organisationId !== targetTeam.organisationId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Target team must belong to the same organisation',
    });
  }

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId: contextTeamId,
  });

  const sourceEnvelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    select: {
      id: true,
      type: true,
      teamId: true,
    },
  });

  if (!sourceEnvelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  if (sourceEnvelope.type !== EnvelopeType.TEMPLATE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only templates can be copied to another team',
    });
  }

  return duplicateEnvelope({
    id,
    userId,
    teamId: contextTeamId,
    targetTeamId,
    requestMetadata,
    overrides,
  });
};
