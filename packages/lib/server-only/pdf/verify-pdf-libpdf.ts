import { PDF } from '@libpdf/core';

import type { CryptoVerificationResult } from './verify-pdf-crypto';
import { verifyPdfSignaturesCryptographically } from './verify-pdf-crypto';

type LibPdfWithVerify = typeof PDF & {
  verify?: (pdfBytes: Uint8Array) => Promise<CryptoVerificationResult>;
};

/**
 * LibPDF-native verification adapter (Phase 3).
 *
 * Uses `PDF.verify()` when @libpdf/core ships it; otherwise delegates to the interim pkijs backend.
 */
export const verifyPdfSignaturesWithLibPdf = async (pdfBytes: Uint8Array): Promise<CryptoVerificationResult> => {
  const libPdf = PDF as LibPdfWithVerify;

  if (typeof libPdf.verify === 'function') {
    return libPdf.verify(pdfBytes);
  }

  return verifyPdfSignaturesCryptographically(pdfBytes);
};
