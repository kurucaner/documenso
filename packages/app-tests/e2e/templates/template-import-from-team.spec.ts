import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { apiSignin } from '../fixtures/authentication';

const nanoid = customAlphabet('1234567890abcdef', 10);

const seedImportScenario = async () => {
  const { user: owner, organisation, team: teamA } = await seedUser();

  const teamBUrl = `team-import-dest-${nanoid()}`;
  const teamBName = `Import destination ${teamBUrl}`;

  await createTeam({
    userId: owner.id,
    teamName: teamBName,
    teamUrl: teamBUrl,
    organisationId: organisation.id,
    inheritMembers: false,
  });

  const templateTitle = `Import source ${nanoid()}`;

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
    teamAName: teamA.name,
    templateTitle,
    template,
  };
};

test('[TEMPLATES]: import template from another team via wizard', async ({ page }) => {
  const { owner, teamA, teamBUrl, teamAName, templateTitle, template } = await seedImportScenario();

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${teamBUrl}/templates`,
  });

  await expect(page.getByTestId('data-table-count')).toContainText('Showing 0 results');

  await page.getByTestId('template-import-from-team-trigger').click();
  await expect(page.getByTestId('template-import-from-team-dialog')).toBeVisible();

  await page.getByTestId('template-import-source-team-select').click();
  await page.getByRole('option', { name: teamAName }).click();
  await page.getByTestId('template-import-next').click();

  await expect(page.getByTestId(`template-import-row-${template.id}`)).toBeVisible();
  await page.getByTestId(`template-import-row-${template.id}`).click();
  await page.getByTestId('template-import-continue').click();

  await page.getByTestId('template-import-submit').click();

  await expect(page.getByText('Template imported').first()).toBeVisible();
  await page.waitForURL(new RegExp(`/t/${teamBUrl}/templates/.+/edit`));

  await page.goto(`/t/${teamBUrl}/templates`);
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');
  await expect(page.getByRole('link', { name: `${templateTitle} (copy)` })).toBeVisible();

  await page.goto(`/t/${teamA.url}/templates`);
  await expect(page.getByTestId('data-table-count')).toContainText('Showing 1 result');
  await expect(page.getByRole('link', { name: templateTitle })).toBeVisible();
});
