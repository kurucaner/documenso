import { describe, expect, it } from 'vitest';

import { buildSignedByteRanges, extractPdfSignatures } from './extract-pdf-signatures';

describe('extractPdfSignatures', () => {
  it('returns empty array when no signatures exist', () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.7\n%%EOF');

    expect(extractPdfSignatures(pdfBytes)).toEqual([]);
  });

  it('extracts byte range metadata from a signature placeholder', () => {
    const pdfBytes = new TextEncoder().encode(
      '%PDF-1.7\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /Contents <0123> /ByteRange [0 10 20 5] >>',
    );

    const signatures = extractPdfSignatures(pdfBytes);

    expect(signatures).toHaveLength(1);
    expect(signatures[0]?.byteRange).toEqual([0, 10, 20, 5]);
    expect(signatures[0]?.subFilter).toBe('ETSI.CAdES.detached');
  });

  it('builds signed byte ranges from byte range tuples', () => {
    const pdfBytes = new TextEncoder().encode('01234567890123456789012345');
    const signed = buildSignedByteRanges(pdfBytes, [0, 10, 20, 5]);

    expect(Buffer.from(signed).toString('utf8')).toBe('012345678901234');
  });
});
