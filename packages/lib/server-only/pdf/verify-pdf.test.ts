import { describe, expect, it, vi } from 'vitest';

vi.mock('./verify-pdf-libpdf', () => ({
  verifyPdfSignaturesWithLibPdf: vi.fn(),
}));

vi.mock('./lookup-envelope-seal', () => ({
  lookupEnvelopeSeal: vi.fn(),
}));

vi.mock('../cert/instance-signing-cert', () => ({
  fingerprintMatchesInstance: vi.fn(),
}));

const { verifyPdfSignaturesWithLibPdf } = await import('./verify-pdf-libpdf');
const { lookupEnvelopeSeal } = await import('./lookup-envelope-seal');
const { fingerprintMatchesInstance } = await import('../cert/instance-signing-cert');
const { verifyPdf } = await import('./verify-pdf');

describe('verifyPdf', () => {
  it('returns trusted when registry matches and signatures are valid', async () => {
    vi.mocked(verifyPdfSignaturesWithLibPdf).mockResolvedValue({
      signatures: [
        { valid: true, signedAt: null, signerSubject: null, signerFingerprintSha256: null, type: 'platform' },
      ],
      hasSignatures: true,
      integrityValid: true,
    });
    vi.mocked(lookupEnvelopeSeal).mockResolvedValue({
      registryMatch: true,
      qrTokenMatch: true,
      signingMode: 'platform',
      document: {
        envelopeId: 'env_1',
        title: 'Test',
        completedAt: '2026-01-01T00:00:00.000Z',
        qrToken: 'qr_abc',
        shareUrl: 'http://localhost:3000/share/qr_abc',
      },
    });
    vi.mocked(fingerprintMatchesInstance).mockResolvedValue(false);

    const result = await verifyPdf({ pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.status).toBe('trusted');
    expect(result.checks.registryMatch).toBe(true);
  });

  it('returns tampered when signatures fail integrity', async () => {
    vi.mocked(verifyPdfSignaturesWithLibPdf).mockResolvedValue({
      signatures: [
        { valid: false, signedAt: null, signerSubject: null, signerFingerprintSha256: null, type: 'platform' },
      ],
      hasSignatures: true,
      integrityValid: false,
    });
    vi.mocked(lookupEnvelopeSeal).mockResolvedValue({
      registryMatch: false,
      qrTokenMatch: false,
      signingMode: null,
    });

    const result = await verifyPdf({ pdfBytes: new Uint8Array([1, 2, 3]) });

    expect(result.status).toBe('tampered');
  });
});
