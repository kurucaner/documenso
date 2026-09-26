import { createHash, X509Certificate } from 'node:crypto';
import fs from 'node:fs';

import { createLocalSigner } from '@documenso/signing/transports/local';
import { parsePem } from '@libpdf/core';

import { NEXT_PRIVATE_SIGNING_TRANSPORT } from '../../constants/app';
import { env } from '../../utils/env';

type InstanceSigningCertCache = {
  fingerprintSha256: string;
  subject: string;
  validTo: string;
} | null;

let cachedInstanceCert: InstanceSigningCertCache | undefined;

const fingerprintFromDer = (certificateDer: Uint8Array) => {
  const certificate = new X509Certificate(Buffer.from(certificateDer));

  return {
    fingerprintSha256: certificate.fingerprint256.replace(/:/g, '').toLowerCase(),
    subject: certificate.subject,
    validTo: new Date(certificate.validTo).toISOString(),
  };
};

const loadGcloudPublicCert = () => {
  const chainContents = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_CERT_CHAIN_CONTENTS');
  const chainFilePath = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_CERT_CHAIN_FILE_PATH');

  if (chainContents) {
    const blocks = parsePem(Buffer.from(chainContents, 'base64').toString('utf-8'));

    if (blocks[0]) {
      return fingerprintFromDer(blocks[0].der);
    }
  }

  if (chainFilePath) {
    const blocks = parsePem(fs.readFileSync(chainFilePath).toString('utf-8'));

    if (blocks[0]) {
      return fingerprintFromDer(blocks[0].der);
    }
  }

  const certContents = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS');
  const certFilePath = env('NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_PATH');

  if (certContents) {
    const blocks = parsePem(Buffer.from(certContents, 'base64').toString('utf-8'));

    if (blocks[0]) {
      return fingerprintFromDer(blocks[0].der);
    }
  }

  if (certFilePath) {
    const blocks = parsePem(fs.readFileSync(certFilePath).toString('utf-8'));

    if (blocks[0]) {
      return fingerprintFromDer(blocks[0].der);
    }
  }

  return null;
};

/**
 * Returns the SHA-256 fingerprint of this instance's platform signing certificate.
 * Used to confirm a PDF was sealed by this Documenso deployment (local / gcloud-hsm).
 */
export const getInstanceSigningCertFingerprint = async () => {
  if (cachedInstanceCert !== undefined) {
    return cachedInstanceCert;
  }

  const transport = NEXT_PRIVATE_SIGNING_TRANSPORT();

  if (transport === 'csc') {
    cachedInstanceCert = null;

    return cachedInstanceCert;
  }

  if (transport === 'gcloud-hsm') {
    cachedInstanceCert = loadGcloudPublicCert();

    return cachedInstanceCert;
  }

  if (transport !== 'local') {
    cachedInstanceCert = null;

    return cachedInstanceCert;
  }

  try {
    const signer = await createLocalSigner({ buildChain: false });
    const certificate = new X509Certificate(Buffer.from(signer.certificate));

    cachedInstanceCert = {
      fingerprintSha256: certificate.fingerprint256.replace(/:/g, '').toLowerCase(),
      subject: certificate.subject,
      validTo: new Date(certificate.validTo).toISOString(),
    };
  } catch {
    cachedInstanceCert = null;
  }

  return cachedInstanceCert;
};

export const fingerprintMatchesInstance = async (fingerprintSha256: string | null) => {
  if (!fingerprintSha256) {
    return false;
  }

  const instanceCert = await getInstanceSigningCertFingerprint();

  if (!instanceCert) {
    return false;
  }

  return instanceCert.fingerprintSha256 === fingerprintSha256.toLowerCase();
};

export const sha256Hex = (bytes: Uint8Array) => {
  return createHash('sha256').update(bytes).digest('hex');
};
