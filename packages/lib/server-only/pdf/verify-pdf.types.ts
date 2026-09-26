export type VerifyStatus = 'trusted' | 'tampered' | 'unsigned' | 'unknown_valid';

export type VerifySignatureType = 'platform' | 'recipient' | 'timestamp';

export type VerifySignatureResult = {
  valid: boolean;
  signedAt: string | null;
  signerSubject: string | null;
  signerFingerprintSha256: string | null;
  type: VerifySignatureType;
};

export type VerifyDocumentMetadata = {
  envelopeId: string;
  title: string;
  completedAt: string;
  qrToken: string | null;
  shareUrl: string;
};

export type VerifyResult = {
  status: VerifyStatus;
  summary: string;
  signatures: VerifySignatureResult[];
  document?: VerifyDocumentMetadata;
  checks: {
    integrityValid: boolean;
    instanceMatch: boolean;
    registryMatch: boolean;
  };
};

export type VerifyPdfOptions = {
  pdfBytes: Uint8Array;
  qrToken?: string | null;
};
