-- Staff accounts with per-module access, and two-factor sign-in.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffAccess" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "staffTitle" TEXT,
ADD COLUMN "staffInvitedAt" TIMESTAMP(3),
ADD COLUMN "staffJoinedAt" TIMESTAMP(3),
ADD COLUMN "invitedById" TEXT,
ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpPendingSecret" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER,
ADD COLUMN "mfaFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mfaLockedUntil" TIMESTAMP(3),
ADD COLUMN "lastSignInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "mfaAt" TIMESTAMP(3),
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'session';

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
