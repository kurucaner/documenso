-- CreateTable
CREATE TABLE "EnvelopeSeal" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "envelopeItemId" TEXT NOT NULL,
    "sealedPdfSha256" TEXT NOT NULL,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qrToken" TEXT,
    "signingMode" TEXT NOT NULL,

    CONSTRAINT "EnvelopeSeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvelopeSeal_envelopeItemId_key" ON "EnvelopeSeal"("envelopeItemId");

-- CreateIndex
CREATE INDEX "EnvelopeSeal_sealedPdfSha256_idx" ON "EnvelopeSeal"("sealedPdfSha256");

-- CreateIndex
CREATE INDEX "EnvelopeSeal_qrToken_idx" ON "EnvelopeSeal"("qrToken");

-- CreateIndex
CREATE INDEX "EnvelopeSeal_envelopeId_idx" ON "EnvelopeSeal"("envelopeId");

-- AddForeignKey
ALTER TABLE "EnvelopeSeal" ADD CONSTRAINT "EnvelopeSeal_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeSeal" ADD CONSTRAINT "EnvelopeSeal_envelopeItemId_fkey" FOREIGN KEY ("envelopeItemId") REFERENCES "EnvelopeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
