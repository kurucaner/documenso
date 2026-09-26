import { verifyPdfHandler } from '@documenso/lib/server-only/public-api/verify-pdf-handler';

export const action = async ({ request }: { request: Request }) => {
  return verifyPdfHandler(request);
};
