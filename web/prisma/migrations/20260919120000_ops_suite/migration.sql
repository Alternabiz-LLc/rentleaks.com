-- Ops suite: speed-to-lead, shortlists, catalogue health, bookings,
-- trust radar, playbooks and the morning brief.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "briefHour" INTEGER,
ADD COLUMN "briefLastSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "freshnessAskedAt" TIMESTAMP(3),
ADD COLUMN "fixRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "ackSentAt" TIMESTAMP(3),
ADD COLUMN "escalatedAt" TIMESTAMP(3),
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "matchesSentAt" TIMESTAMP(3),
ADD COLUMN "matchIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "shortlistOpenedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "listingId" TEXT,
    "contactId" TEXT,
    "renterName" TEXT NOT NULL,
    "renterEmail" TEXT NOT NULL,
    "renterPhone" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'viewing',
    "viewingAt" TIMESTAMP(3),
    "viewingMode" TEXT,
    "viewingConfirmedAt" TIMESTAMP(3),
    "moveIn" TEXT,
    "moveOut" TEXT,
    "monthlyAllIn" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT,
    "lostReason" TEXT,
    "renewalRemindedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustDismissal" (
    "id" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "waitMinutes" INTEGER NOT NULL DEFAULT 60,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookRun" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'done',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaybookRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_stage_idx" ON "Booking"("stage");

-- CreateIndex
CREATE INDEX "Booking_listingId_idx" ON "Booking"("listingId");

-- CreateIndex
CREATE INDEX "Booking_leadId_idx" ON "Booking"("leadId");

-- CreateIndex
CREATE INDEX "Booking_viewingAt_idx" ON "Booking"("viewingAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrustDismissal_signal_key" ON "TrustDismissal"("signal");

-- CreateIndex
CREATE INDEX "PlaybookRun_createdAt_idx" ON "PlaybookRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookRun_playbookId_targetType_targetId_key" ON "PlaybookRun"("playbookId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "PlaybookRun" ADD CONSTRAINT "PlaybookRun_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
