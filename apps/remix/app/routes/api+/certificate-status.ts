import { getCertificateStatus } from '@documenso/lib/server-only/cert/cert-status';

export const loader = async () => {
  try {
    const certStatus = await getCertificateStatus();

    return Response.json({
      isAvailable: certStatus.isAvailable,
      validTo: certStatus.validTo,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        isAvailable: false,
        validTo: null,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
};
