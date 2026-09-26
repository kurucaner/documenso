import { formatPageTitle } from '@documenso/lib/constants/branding';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';

import { VerifyPdfUpload } from '~/components/general/verify/verify-pdf-upload';

export const meta = () => {
  return [{ title: formatPageTitle('Verify document') }];
};

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') ?? undefined;

  return (
    <div className="w-full max-w-2xl">
      <VerifyPdfUpload qrToken={token} />
      <p className="mt-8 text-center text-muted-foreground text-xs">
        <Trans>Only completed, sealed PDF downloads can be verified. We do not keep uploaded files.</Trans>
      </p>
    </div>
  );
}
