import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createLocalSignerMock } = vi.hoisted(() => ({
  createLocalSignerMock: vi.fn(),
}));

vi.mock('@documenso/signing/transports/local', () => ({
  createLocalSigner: createLocalSignerMock,
}));

vi.mock('../../constants/app', () => ({
  NEXT_PRIVATE_SIGNING_TRANSPORT: vi.fn(() => 'local'),
}));

const { getCertificateStatus } = await import('./cert-status');
const { NEXT_PRIVATE_SIGNING_TRANSPORT } = await import('../../constants/app');

function createSelfSignedCertificateDer(validDays: number) {
  const dir = mkdtempSync(join(tmpdir(), 'cert-status-'));
  const certPath = join(dir, 'cert.der');
  const keyPath = join(dir, 'key.pem');

  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-outform',
        'DER',
        '-out',
        certPath,
        '-days',
        String(validDays),
        '-subj',
        '/CN=Documenso Test Signing',
      ],
      { stdio: 'pipe' },
    );

    const certificate = readFileSync(certPath);
    const parsed = new X509Certificate(certificate);

    return {
      certificate,
      validTo: parsed.validTo,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('getCertificateStatus', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(NEXT_PRIVATE_SIGNING_TRANSPORT).mockReturnValue('local');
  });

  it('returns validTo for a readable local certificate', async () => {
    const { certificate, validTo } = createSelfSignedCertificateDer(30);
    createLocalSignerMock.mockResolvedValue({ certificate });

    const status = await getCertificateStatus();

    expect(status.isAvailable).toBe(true);
    expect(status.validTo).toBe(new Date(validTo).toISOString());
  });

  it('returns validTo but isAvailable false when the certificate is expired', async () => {
    const { certificate, validTo } = createSelfSignedCertificateDer(30);
    createLocalSignerMock.mockResolvedValue({ certificate });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(validTo).getTime() + 86_400_000);

    try {
      const status = await getCertificateStatus();

      expect(status.isAvailable).toBe(false);
      expect(status.validTo).toBe(new Date(validTo).toISOString());
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null validTo when the local certificate cannot be opened', async () => {
    createLocalSignerMock.mockRejectedValue(new Error('bad passphrase'));

    const status = await getCertificateStatus();

    expect(status).toEqual({ isAvailable: false, validTo: null });
  });

  it('returns null validTo for remote signing transports', async () => {
    vi.mocked(NEXT_PRIVATE_SIGNING_TRANSPORT).mockReturnValue('gcloud-hsm');

    const status = await getCertificateStatus();

    expect(status).toEqual({ isAvailable: true, validTo: null });
  });
});
