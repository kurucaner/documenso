import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { Navigate } from 'react-router';

import { useCurrentTeam } from '~/providers/team';

/**
 * Integration-managed orgs provision API tokens and webhooks via the connecting application.
 * Redirect direct /settings/tokens or /settings/webhooks navigations away from the dashboard UI.
 */
export const ManagedIntegrationCredentialsSettingsRedirect = () => {
  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  if (!organisation.isManaged) {
    return null;
  }

  return <Navigate replace to={`/t/${team.url}/settings/general`} />;
};
