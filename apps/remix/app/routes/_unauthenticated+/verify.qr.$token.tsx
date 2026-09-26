import { formatPageTitle } from '@documenso/lib/constants/branding';
import { redirect } from 'react-router';

import type { Route } from './+types/verify.qr.$token';

export const meta = () => {
  return [{ title: formatPageTitle('Verify document') }];
};

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { token } = params;

  if (!token.startsWith('qr_')) {
    throw redirect('/verify');
  }

  throw redirect(`/verify?t=${encodeURIComponent(token)}`);
};
