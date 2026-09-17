-- Guide downloads (lead magnets) and partner headshots for the public roster.

ALTER TABLE "NetworkPartner"
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "photoData" BYTEA,
  ADD COLUMN "photoType" TEXT,
  ADD COLUMN "photoAt" TIMESTAMP(3),
  ADD COLUMN "featuredAt" TIMESTAMP(3);

CREATE TABLE "GuideLead" (
    "id" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "brokerage" TEXT,
    "licenseState" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT true,
    "consentText" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'web',
    "campaign" TEXT,
    "referrer" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "tokenHash" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'new',
    "note" TEXT,
    "contactedAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "partnerId" TEXT,
    "searchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuideLead_tokenHash_key" ON "GuideLead"("tokenHash");
CREATE INDEX "GuideLead_audience_createdAt_idx" ON "GuideLead"("audience", "createdAt");
CREATE INDEX "GuideLead_status_createdAt_idx" ON "GuideLead"("status", "createdAt");
CREATE INDEX "GuideLead_email_idx" ON "GuideLead"("email");
