-- Broker network: partners, tenant searches, lead offers, e-signed agreements, referral deals.

-- CreateTable
CREATE TABLE "NetworkPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "brokerage" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseState" TEXT NOT NULL,
    "licenseExpires" TEXT,
    "supervisorName" TEXT,
    "supervisorEmail" TEXT,
    "markets" TEXT NOT NULL DEFAULT '[]',
    "specialties" TEXT NOT NULL DEFAULT '[]',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "bio" TEXT NOT NULL DEFAULT '',
    "website" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 5,
    "referralPctBp" INTEGER NOT NULL DEFAULT 2500,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "portalTokenHash" TEXT,
    "agreementId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifyNote" TEXT,
    "lastOfferedAt" TIMESTAMP(3),
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkSearch" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "neighborhoods" TEXT NOT NULL DEFAULT '[]',
    "homeType" TEXT NOT NULL DEFAULT 'apartment',
    "buildingAge" TEXT NOT NULL DEFAULT 'any',
    "bedrooms" INTEGER,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER NOT NULL,
    "moveIn" TEXT,
    "term" TEXT NOT NULL DEFAULT 'long',
    "termMonths" INTEGER,
    "mustHaves" TEXT NOT NULL DEFAULT '[]',
    "language" TEXT,
    "feeCapType" TEXT NOT NULL DEFAULT 'none',
    "feeCapValue" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'web',
    "campaign" TEXT,
    "referrer" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "roomTokenHash" TEXT NOT NULL,
    "chosenPartnerId" TEXT,
    "agreementId" TEXT,
    "stageAt" TIMESTAMP(3),
    "leasedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "rating" INTEGER,
    "note" TEXT,
    "noMatchAt" TIMESTAMP(3),
    "nudgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkOffer" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "reasons" TEXT NOT NULL DEFAULT '[]',
    "feeType" TEXT,
    "feeValue" INTEGER,
    "pitch" TEXT NOT NULL DEFAULT '',
    "declineWhy" TEXT,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "chosenAt" TIMESTAMP(3),

    CONSTRAINT "NetworkOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sections" TEXT NOT NULL,
    "terms" TEXT NOT NULL DEFAULT '{}',
    "docHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "searchId" TEXT,
    "partnerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementSigner" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "consentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signatureKind" TEXT,
    "signedName" TEXT,
    "signatureImage" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "remindedAt" TIMESTAMP(3),
    "reminders" INTEGER NOT NULL DEFAULT 0,
    "signedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementEvent" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "signerId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkDeal" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "leaseSignedOn" TEXT NOT NULL,
    "monthlyRentCents" INTEGER NOT NULL,
    "grossFeeCents" INTEGER NOT NULL,
    "referralPctBp" INTEGER NOT NULL,
    "referralDueCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "invoiceId" TEXT,
    "address" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPartner_email_key" ON "NetworkPartner"("email");
CREATE UNIQUE INDEX "NetworkPartner_portalTokenHash_key" ON "NetworkPartner"("portalTokenHash");
CREATE INDEX "NetworkPartner_status_idx" ON "NetworkPartner"("status");
CREATE INDEX "NetworkPartner_licenseState_status_idx" ON "NetworkPartner"("licenseState", "status");
CREATE UNIQUE INDEX "NetworkSearch_roomTokenHash_key" ON "NetworkSearch"("roomTokenHash");
CREATE INDEX "NetworkSearch_status_createdAt_idx" ON "NetworkSearch"("status", "createdAt");
CREATE INDEX "NetworkSearch_email_idx" ON "NetworkSearch"("email");
CREATE INDEX "NetworkSearch_chosenPartnerId_idx" ON "NetworkSearch"("chosenPartnerId");
CREATE UNIQUE INDEX "NetworkOffer_searchId_partnerId_key" ON "NetworkOffer"("searchId", "partnerId");
CREATE INDEX "NetworkOffer_partnerId_status_idx" ON "NetworkOffer"("partnerId", "status");
CREATE INDEX "NetworkOffer_status_expiresAt_idx" ON "NetworkOffer"("status", "expiresAt");
CREATE INDEX "Agreement_kind_status_idx" ON "Agreement"("kind", "status");
CREATE INDEX "Agreement_searchId_idx" ON "Agreement"("searchId");
CREATE INDEX "Agreement_partnerId_idx" ON "Agreement"("partnerId");
CREATE UNIQUE INDEX "AgreementSigner_tokenHash_key" ON "AgreementSigner"("tokenHash");
CREATE INDEX "AgreementSigner_agreementId_order_idx" ON "AgreementSigner"("agreementId", "order");
CREATE INDEX "AgreementSigner_email_idx" ON "AgreementSigner"("email");
CREATE INDEX "AgreementEvent_agreementId_createdAt_idx" ON "AgreementEvent"("agreementId", "createdAt");
CREATE UNIQUE INDEX "NetworkDeal_searchId_key" ON "NetworkDeal"("searchId");
CREATE INDEX "NetworkDeal_partnerId_idx" ON "NetworkDeal"("partnerId");
CREATE INDEX "NetworkDeal_status_idx" ON "NetworkDeal"("status");

-- AddForeignKey
ALTER TABLE "NetworkOffer" ADD CONSTRAINT "NetworkOffer_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "NetworkSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkOffer" ADD CONSTRAINT "NetworkOffer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "NetworkPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementSigner" ADD CONSTRAINT "AgreementSigner_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementEvent" ADD CONSTRAINT "AgreementEvent_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
