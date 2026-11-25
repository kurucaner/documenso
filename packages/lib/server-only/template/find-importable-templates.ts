import { prisma } from '@documenso/prisma';
import { EnvelopeType, type Prisma, TemplateType } from '@prisma/client';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { FindResultResponse } from '../../types/search-params';
import { getMemberRoles } from '../team/get-member-roles';
import { getTeamById } from '../team/get-team';
import { buildTemplateSearchFilter } from './build-template-search-filter';

export type FindImportableTemplatesOptions = {
  userId: number;
  /**
   * The team context the user is importing into (current team).
   */
  contextTeamId: number;
  /**
   * The team to list copyable templates from.
   */
  sourceTeamId: number;
  page?: number;
  perPage?: number;
  query?: string;
};

export type TImportableTemplateRow = {
  envelopeId: string;
  title: string;
  teamId: number;
  templateType: TemplateType | null;
};

export const findImportableTemplates = async ({
  userId,
  contextTeamId,
  sourceTeamId,
  page = 1,
  perPage = 10,
  query,
}: FindImportableTemplatesOptions) => {
  const [contextTeam, sourceTeam, { teamRole: sourceTeamRole }, { teamRole: contextTeamRole }] = await Promise.all([
    getTeamById({ userId, teamId: contextTeamId }),
    getTeamById({ userId, teamId: sourceTeamId }),
    getMemberRoles({
      teamId: sourceTeamId,
      reference: {
        type: 'User',
        id: userId,
      },
    }),
    getMemberRoles({
      teamId: contextTeamId,
      reference: {
        type: 'User',
        id: userId,
      },
    }),
  ]);

  if (contextTeam.organisationId !== sourceTeam.organisationId) {
    return {
      data: [],
      count: 0,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: 0,
    } satisfies FindResultResponse<TImportableTemplateRow>;
  }

  const searchFilter = buildTemplateSearchFilter(query);

  const accessibilityFilter: Prisma.EnvelopeWhereInput = {
    OR: [
      {
        templateType: {
          not: TemplateType.ORGANISATION,
        },
        OR: [
          {
            visibility: {
              in: TEAM_DOCUMENT_VISIBILITY_MAP[sourceTeamRole],
            },
          },
          {
            userId,
          },
        ],
      },
      {
        templateType: TemplateType.ORGANISATION,
        visibility: {
          in: TEAM_DOCUMENT_VISIBILITY_MAP[contextTeamRole],
        },
      },
    ],
  };

  const where: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.TEMPLATE,
    teamId: sourceTeamId,
    AND: [accessibilityFilter, ...(searchFilter ? [searchFilter] : [])],
  };

  const [rows, count] = await Promise.all([
    prisma.envelope.findMany({
      where,
      select: {
        id: true,
        title: true,
        teamId: true,
        templateType: true,
      },
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.envelope.count({ where }),
  ]);

  const data: TImportableTemplateRow[] = rows.map((row) => ({
    envelopeId: row.id,
    title: row.title,
    teamId: row.teamId,
    templateType: row.templateType,
  }));

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<TImportableTemplateRow>;
};
