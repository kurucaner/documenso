import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Trans } from '@lingui/react/macro';

export type ManagedOrganisationAlertProps = {
  className?: string;
};

export const ManagedOrganisationAlert = ({ className }: ManagedOrganisationAlertProps) => {
  return (
    <Alert className={cn(className)} variant="neutral">
      <AlertTitle>
        <Trans>Integration-managed workspace</Trans>
      </AlertTitle>
      <AlertDescription>
        <Trans>
          This organisation is managed by an integration. Change workspace settings in the application that connected
          Documenso.
        </Trans>
      </AlertDescription>
    </Alert>
  );
};
