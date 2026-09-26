import { NEXT_PRIVATE_SIGNING_TRANSPORT } from '../../constants/app';
import { fingerprintMatchesInstance } from '../cert/instance-signing-cert';
import { lookupEnvelopeSeal } from './lookup-envelope-seal';
import type { VerifyPdfOptions, VerifyResult, VerifyStatus } from './verify-pdf.types';
import { verifyPdfSignaturesWithLibPdf } from './verify-pdf-libpdf';

const buildSummary = (status: VerifyStatus) => {
  switch (status) {
    case 'trusted':
      return 'This document is authentic and unchanged.';
    case 'tampered':
      return 'This document was modified after signing.';
    case 'unknown_valid':
      return 'This document is signed, but not by this Documenso instance.';
    case 'unsigned':
      return 'No valid Documenso signature found.';
  }
};

const resolveStatus = ({
  hasSignatures,
  integrityValid,
  instanceMatch,
  registryMatch,
  qrTokenProvided,
  qrTokenMatch,
  transport,
}: {
  hasSignatures: boolean;
  integrityValid: boolean;
  instanceMatch: boolean;
  registryMatch: boolean;
  qrTokenProvided: boolean;
  qrTokenMatch: boolean;
  transport: string;
}): VerifyStatus => {
  if (!hasSignatures) {
    return 'unsigned';
  }

  if (!integrityValid) {
    return 'tampered';
  }

  if (qrTokenProvided && !qrTokenMatch) {
    return 'tampered';
  }

  if (registryMatch) {
    return 'trusted';
  }

  if (transport === 'csc') {
    return 'unknown_valid';
  }

  if (instanceMatch) {
    return 'trusted';
  }

  return 'unknown_valid';
};

export const verifyPdf = async ({ pdfBytes, qrToken }: VerifyPdfOptions): Promise<VerifyResult> => {
  const transport = NEXT_PRIVATE_SIGNING_TRANSPORT() ?? 'local';

  const [cryptoResult, registryResult] = await Promise.all([
    verifyPdfSignaturesWithLibPdf(pdfBytes),
    lookupEnvelopeSeal({ pdfBytes, qrToken }),
  ]);

  const instanceMatch =
    cryptoResult.signatures.some((signature) => signature.valid) &&
    (await Promise.all(
      cryptoResult.signatures
        .filter((signature) => signature.valid && signature.signerFingerprintSha256)
        .map((signature) => fingerprintMatchesInstance(signature.signerFingerprintSha256)),
    ).then((matches) => matches.some(Boolean)));

  const status = resolveStatus({
    hasSignatures: cryptoResult.hasSignatures,
    integrityValid: cryptoResult.integrityValid,
    instanceMatch,
    registryMatch: registryResult.registryMatch,
    qrTokenProvided: Boolean(qrToken),
    qrTokenMatch: registryResult.qrTokenMatch,
    transport,
  });

  return {
    status,
    summary: buildSummary(status),
    signatures: cryptoResult.signatures,
    document: registryResult.document,
    checks: {
      integrityValid: cryptoResult.integrityValid,
      instanceMatch,
      registryMatch: registryResult.registryMatch,
    },
  };
};
