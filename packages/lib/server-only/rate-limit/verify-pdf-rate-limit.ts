import { createRateLimit } from './rate-limit';

export const verifyPdfRateLimit = createRateLimit({
  action: 'api.verify-pdf',
  max: 20,
  globalMax: 100,
  window: '15m',
});

export const VERIFY_PDF_MAX_BYTES = 25 * 1024 * 1024;
