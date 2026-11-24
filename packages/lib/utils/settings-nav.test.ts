import { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { getSettingsNavGroups } from './settings-nav';

describe('getSettingsNavGroups managed organisation', () => {
  const baseOrg = {
    url: 'managed-org',
    currentOrganisationRole: OrganisationMemberRole.ADMIN,
    organisationClaim: { flags: {} },
  };

  const baseTeam = {
    url: 'property-team',
    currentTeamRole: TeamMemberRole.ADMIN,
  };

  it('omits API Tokens and Webhooks team nav items when organisation is managed', () => {
    const groups = getSettingsNavGroups({
      organisation: { ...baseOrg, isManaged: true },
      team: baseTeam,
      hasManageableBillingOrgs: false,
    });

    const keys = groups.team?.items.map((item) => item.key) ?? [];

    expect(keys).not.toContain('tokens');
    expect(keys).not.toContain('webhooks');
    expect(keys).not.toContain('public-profile');
    expect(keys).toContain('general');
  });

  it('includes API Tokens and Webhooks for self-managed organisations', () => {
    const groups = getSettingsNavGroups({
      organisation: { ...baseOrg, isManaged: false },
      team: baseTeam,
      hasManageableBillingOrgs: false,
    });

    const keys = groups.team?.items.map((item) => item.key) ?? [];

    expect(keys).toContain('tokens');
    expect(keys).toContain('webhooks');
  });
});
