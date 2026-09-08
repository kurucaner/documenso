-- CreateTable
CREATE TABLE "BootstrapSessionToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BootstrapSessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BootstrapSessionToken_tokenHash_key" ON "BootstrapSessionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BootstrapSessionToken_userId_expiresAt_idx" ON "BootstrapSessionToken"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "BootstrapSessionToken" ADD CONSTRAINT "BootstrapSessionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
