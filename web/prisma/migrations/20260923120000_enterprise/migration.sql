-- Enterprise services: requests, engagements, deliverables, managed properties, owner statements.

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "engagementId" TEXT;

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "role" TEXT NOT NULL DEFAULT 'landlord',
    "propertyKind" TEXT NOT NULL DEFAULT 'building',
    "units" INTEGER,
    "buildings" INTEGER,
    "market" TEXT,
    "address" TEXT,
    "ownerLocation" TEXT,
    "outOfState" BOOLEAN NOT NULL DEFAULT false,
    "services" TEXT NOT NULL DEFAULT '[]',
    "addOns" TEXT NOT NULL DEFAULT '[]',
    "packageId" TEXT,
    "timeline" TEXT NOT NULL DEFAULT 'exploring',
    "message" TEXT NOT NULL DEFAULT '',
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'web',
    "campaign" TEXT,
    "referrer" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "lostReason" TEXT,
    "assignedToId" TEXT,
    "contactedAt" TIMESTAMP(3),
    "ackSentAt" TIMESTAMP(3),
    "engagementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientCompany" TEXT,
    "clientPhone" TEXT,
    "userId" TEXT,
    "requestId" TEXT,
    "track" TEXT NOT NULL,
    "packageId" TEXT,
    "services" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'proposal',
    "feeModel" TEXT NOT NULL DEFAULT 'monthly',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "pctBp" INTEGER NOT NULL DEFAULT 0,
    "units" INTEGER NOT NULL DEFAULT 0,
    "rentRollCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "market" TEXT,
    "address" TEXT,
    "ownerLocation" TEXT,
    "agreementRef" TEXT,
    "agreementSignedOn" TEXT,
    "proposalSentAt" TIMESTAMP(3),
    "startDate" TEXT,
    "endDate" TEXT,
    "note" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementTask" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedProperty" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "market" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'building',
    "units" INTEGER NOT NULL DEFAULT 1,
    "occupied" INTEGER NOT NULL DEFAULT 0,
    "rentRollCents" INTEGER NOT NULL DEFAULT 0,
    "pctBp" INTEGER NOT NULL DEFAULT 0,
    "flatFeeCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'onboarding',
    "listingIds" TEXT NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerStatement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "collectedCents" INTEGER NOT NULL DEFAULT 0,
    "expensesCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "occupied" INTEGER NOT NULL DEFAULT 0,
    "expenseLines" TEXT NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_engagementId_idx" ON "Invoice"("engagementId");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_createdAt_idx" ON "ServiceRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_email_idx" ON "ServiceRequest"("email");

-- CreateIndex
CREATE INDEX "Engagement_status_idx" ON "Engagement"("status");

-- CreateIndex
CREATE INDEX "Engagement_clientEmail_idx" ON "Engagement"("clientEmail");

-- CreateIndex
CREATE INDEX "Engagement_userId_idx" ON "Engagement"("userId");

-- CreateIndex
CREATE INDEX "EngagementTask_engagementId_position_idx" ON "EngagementTask"("engagementId", "position");

-- CreateIndex
CREATE INDEX "EngagementTask_doneAt_dueDate_idx" ON "EngagementTask"("doneAt", "dueDate");

-- CreateIndex
CREATE INDEX "ManagedProperty_status_idx" ON "ManagedProperty"("status");

-- CreateIndex
CREATE INDEX "ManagedProperty_ownerEmail_idx" ON "ManagedProperty"("ownerEmail");

-- CreateIndex
CREATE INDEX "OwnerStatement_month_idx" ON "OwnerStatement"("month");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_propertyId_month_key" ON "OwnerStatement"("propertyId", "month");

-- AddForeignKey
ALTER TABLE "EngagementTask" ADD CONSTRAINT "EngagementTask_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProperty" ADD CONSTRAINT "ManagedProperty_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerStatement" ADD CONSTRAINT "OwnerStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ManagedProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
