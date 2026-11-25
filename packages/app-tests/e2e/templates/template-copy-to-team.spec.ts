import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';
import { openDropdownMenu } from '../fixtures/generic';

const nanoid = customAlphabet('1234567890abcdef', 10);

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const trpcMutation = async (page: Page, procedure: string, input: Record<string, unknown>, teamId?: number) => {
  const url = `${WEBAPP_BASE_URL}/api/trpc/${procedure}`;

  const headers: Record<string, string> = {
    ...WEBAPP_ORIGIN_HEADERS,
    'content-type': 'application/json',
  };

  if (teamId) {
    headers['x-team-id'] = teamId.toString();
  }

  const res = await page.context().request.post(url, {
    data: JSON.stringify({ json: input }),
    headers,
  });

  return { res, json: res.ok() ? await res.json() : null };
};

const seedTwoTeamScenario = async () => {
  const { user: owner, organisation, team: teamA } = await seedUser();

  const teamBUrl = `team-copy-dest-${nanoid()}`;
  const teamBName = `Destination ${teamBUrl}`;

  await createTeam({
    userId: owner.id,
    teamName: teamBName,
    teamUrl: teamBUrl,
    organisationId: organisation.id,
    inheritMembers: false,
  });

  const templateTitle = `Cross-team source ${nanoid()}`;

  const template = await seedBlankTemplate(owner, teamA.id, {
    createTemplateOptions: {
      title: templateTitle,
    },
  });

  return {
    owner,
    teamA,
    teamBUrl,
    teamBName,
    templateTitle,
    template,
  };
};

test('[TEMPLATES]: copy template to another team in the same organisation', async ({ page }) => {
  const { owner, teamA, teamBUrl, teamBName, templateTitle } = await seedTwoTeamScenario();

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${teamA.url}/templates`,
  });

  const actionBtn = page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1);
  await openDropdownMenu(page, actionBtn);

  await page.getByTestId('template-copy-to-team-menuitem').click();
  await expect(page.getByTestId('template-copy-to-team-dialog')).toBeVisible();

  await page.getByTestId('template-copy-to-team-select').click();
  await page.getByRole('option', { name: teamBName }).click();
  await page.getByTestId('template-copy-to-team-submit').click();

  await expect(page.getByText('Template copied').first()).toBeVisible();
  await page.waitForURL(new RegExp(`/t/${teamBUrl}/templates/.+/edit`));

  await page.goto(`/t/${teamBUrl}/templates`);
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');
  await expect(page.getByRole('link', { name: `${templateTitle} (copy)` })).toBeVisible();

  await page.goto(`/t/${teamA.url}/templates`);
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');
  await expect(page.getByRole('link', { name: templateTitle })).toBeVisible();
});

test('[TEMPLATES]: envelope.copyToTeam rejects target team in another organisation', async ({ page }) => {
  const { owner, teamA, template } = await seedTwoTeamScenario();
  const { team: foreignTeam } = await seedUser();

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${teamA.url}/templates`,
  });

  const { res } = await trpcMutation(
    page,
    'envelope.copyToTeam',
    {
      envelopeId: template.id,
      targetTeamId: foreignTeam.id,
    },
    teamA.id,
  );

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
});
