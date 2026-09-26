import { getIpAddress } from '../../universal/get-ip-address';
import { verifyPdf } from '../pdf/verify-pdf';
import { VERIFY_PDF_MAX_BYTES, verifyPdfRateLimit } from '../rate-limit/verify-pdf-rate-limit';

export const verifyPdfHandler = async (request: Request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const ip = getIpAddress(request) ?? 'unknown';
  const rateLimit = await verifyPdfRateLimit.check({ ip });

  if (rateLimit.isLimited) {
    return Response.json({ error: 'Too many verification requests. Please try again later.' }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const tokenValue = formData.get('token');
  const qrToken = typeof tokenValue === 'string' && tokenValue.length > 0 ? tokenValue : undefined;

  if (!(file instanceof File)) {
    return Response.json({ error: 'A PDF file is required.' }, { status: 400 });
  }

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: 'Only PDF files are supported.' }, { status: 400 });
  }

  if (file.size > VERIFY_PDF_MAX_BYTES) {
    return Response.json({ error: 'File exceeds the 25MB upload limit.' }, { status: 413 });
  }

  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const result = await verifyPdf({ pdfBytes, qrToken });

  return Response.json(result);
};
