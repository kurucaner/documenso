import { prisma } from '@documenso/prisma';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';

import { sha256Hex } from '../cert/instance-signing-cert';
import type { VerifyDocumentMetadata } from './verify-pdf.types';

export type EnvelopeSealLookupResult = {
  registryMatch: boolean;
  qrTokenMatch: boolean;
  signingMode: 'platform' | 'csc' | null;
  document?: VerifyDocumentMetadata;
};

export const lookupEnvelopeSeal = async ({
  pdfBytes,
  qrToken,
}: {
  pdfBytes: Uint8Array;
  qrToken?: string | null;
}): Promise<EnvelopeSealLookupResult> => {
  const sealedPdfSha256 = sha256Hex(pdfBytes);

  const seal = await prisma.envelopeSeal.findFirst({
    where: {
      sealedPdfSha256,
    },
    include: {
      envelope: {
        select: {
          id: true,
          title: true,
          completedAt: true,
          qrToken: true,
        },
      },
    },
  });

  if (!seal) {
    return {
      registryMatch: false,
      qrTokenMatch: false,
      signingMode: null,
    };
  }

  const qrTokenMatch = qrToken ? seal.qrToken === qrToken : true;

  const webappUrl = NEXT_PUBLIC_WEBAPP_URL();

  return {
    registryMatch: true,
    qrTokenMatch,
    signingMode: seal.signingMode === 'csc' ? 'csc' : 'platform',
    document: {
      envelopeId: seal.envelopeId,
      title: seal.envelope.title,
      completedAt: seal.envelope.completedAt?.toISOString() ?? seal.sealedAt.toISOString(),
      qrToken: seal.qrToken,
      shareUrl: seal.qrToken ? `${webappUrl}/share/${seal.qrToken}` : webappUrl,
    },
  };
};
