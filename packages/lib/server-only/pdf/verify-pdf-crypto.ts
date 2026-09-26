import { webcrypto, X509Certificate } from 'node:crypto';

import * as asn1js from 'asn1js';
import { Certificate, ContentInfo, CryptoEngine, SignedData, setEngine } from 'pkijs';

import {
  buildSignedByteRanges,
  decodeSignatureContents,
  type ExtractedPdfSignature,
  extractPdfSignatures,
} from './extract-pdf-signatures';
import type { VerifySignatureResult, VerifySignatureType } from './verify-pdf.types';

let isPkijsEngineInitialized = false;

const ensurePkijsEngine = () => {
  if (isPkijsEngineInitialized) {
    return;
  }

  setEngine(
    'node-crypto',
    new CryptoEngine({
      crypto: webcrypto as unknown as Crypto,
      subtle: webcrypto.subtle as unknown as SubtleCrypto,
    }),
  );
  isPkijsEngineInitialized = true;
};

const getSignerFingerprint = (signedData: SignedData, signerIndex: number) => {
  const signerInfo = signedData.signerInfos[signerIndex];

  if (!signerInfo) {
    return null;
  }

  const certificate = signedData.certificates?.find((cert): cert is Certificate => {
    return cert instanceof Certificate && cert.serialNumber.isEqual(signerInfo.sid.serialNumber);
  });

  if (!certificate) {
    return null;
  }

  const x509 = new X509Certificate(Buffer.from(certificate.toSchema().toBER(false)));

  return {
    fingerprintSha256: x509.fingerprint256.replace(/:/g, '').toLowerCase(),
    subject: x509.subject,
  };
};

const getSignedAt = (signedData: SignedData, signerIndex: number) => {
  const signerInfo = signedData.signerInfos[signerIndex];
  const signingTimeAttribute = signerInfo?.signedAttrs?.attributes.find((attribute) => {
    return attribute.type === '1.2.840.113549.1.9.5';
  });

  if (!signingTimeAttribute?.values[0]) {
    return null;
  }

  const signingTime = signingTimeAttribute.values[0].toDate();

  return signingTime.toISOString();
};

const inferSignatureType = (subFilter: string | null): VerifySignatureType => {
  if (subFilter?.includes('ETSI.RFC3161')) {
    return 'timestamp';
  }

  return 'platform';
};

const verifySingleSignature = async (
  pdfBytes: Uint8Array,
  signature: ExtractedPdfSignature,
): Promise<VerifySignatureResult> => {
  ensurePkijsEngine();

  try {
    const signedContent = buildSignedByteRanges(pdfBytes, signature.byteRange);
    const pkcs7Buffer = decodeSignatureContents(pdfBytes, signature);
    const asn1 = asn1js.fromBER(pkcs7Buffer);
    const contentInfo = new ContentInfo({ schema: asn1.result });
    const signedData = new SignedData({ schema: contentInfo.content });

    const verificationResults = await signedData.verify({
      signer: 0,
      data: signedContent,
      checkChain: false,
    });

    const isValid = verificationResults === true;
    const signer = getSignerFingerprint(signedData, 0);

    return {
      valid: isValid,
      signedAt: getSignedAt(signedData, 0),
      signerSubject: signer?.subject ?? null,
      signerFingerprintSha256: signer?.fingerprintSha256 ?? null,
      type: inferSignatureType(signature.subFilter),
    };
  } catch {
    return {
      valid: false,
      signedAt: null,
      signerSubject: null,
      signerFingerprintSha256: null,
      type: inferSignatureType(signature.subFilter),
    };
  }
};

export type CryptoVerificationResult = {
  signatures: VerifySignatureResult[];
  hasSignatures: boolean;
  integrityValid: boolean;
};

/**
 * Interim cryptographic verifier (Phase 1). Replaced by LibPDF.verify() when available.
 */
export const verifyPdfSignaturesCryptographically = async (pdfBytes: Uint8Array): Promise<CryptoVerificationResult> => {
  const extracted = extractPdfSignatures(pdfBytes);

  if (extracted.length === 0) {
    return {
      signatures: [],
      hasSignatures: false,
      integrityValid: false,
    };
  }

  const signatures = await Promise.all(extracted.map((signature) => verifySingleSignature(pdfBytes, signature)));

  return {
    signatures,
    hasSignatures: true,
    integrityValid: signatures.length > 0 && signatures.every((signature) => signature.valid),
  };
};
