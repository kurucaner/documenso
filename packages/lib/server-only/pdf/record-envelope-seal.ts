import { prisma } from '@documenso/prisma';

import { sha256Hex } from '../cert/instance-signing-cert';

export type RecordEnvelopeSealOptions = {
  envelopeId: string;
  envelopeItemId: string;
  pdfBytes: Uint8Array;
  qrToken?: string | null;
  signingMode: 'platform' | 'csc';
};

export const recordEnvelopeSeal = async ({
  envelopeId,
  envelopeItemId,
  pdfBytes,
  qrToken,
  signingMode,
}: RecordEnvelopeSealOptions) => {
  const sealedPdfSha256 = sha256Hex(pdfBytes);

  await prisma.envelopeSeal.upsert({
    where: {
      envelopeItemId,
    },
    create: {
      envelopeId,
      envelopeItemId,
      sealedPdfSha256,
      qrToken: qrToken ?? null,
      signingMode,
    },
    update: {
      sealedPdfSha256,
      qrToken: qrToken ?? null,
      signingMode,
      sealedAt: new Date(),
    },
  });
};
