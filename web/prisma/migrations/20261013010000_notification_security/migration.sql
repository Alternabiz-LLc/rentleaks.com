-- Additive only. Verify a backup before applying to any production database.
ALTER TABLE "NetworkPartner" ADD COLUMN "mailboxGateAt" TIMESTAMP(3);
ALTER TABLE "NetworkPartner" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "NetworkPartner" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "NetworkPartner" ADD COLUMN "suspendedById" TEXT;
-- Existing conflicting records must be reviewed; never delete or rewrite them automatically.
CREATE UNIQUE INDEX "NetworkPartner_current_license_key"
  ON "NetworkPartner"(UPPER("licenseState"), UPPER("licenseNumber")) WHERE "status" <> 'rejected' AND "licenseNumber" <> '';
CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dedupeKey" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "audience" TEXT NOT NULL DEFAULT 'external',
  "targetType" TEXT NOT NULL DEFAULT '',
  "targetId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "transport" TEXT,
  "providerId" TEXT,
  "providerEventAt" TIMESTAMP(3),
  "lastError" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "NotificationDelivery_dedupeKey_key" ON "NotificationDelivery"("dedupeKey");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_leaseUntil_idx" ON "NotificationDelivery"("leaseUntil");
CREATE INDEX "NotificationDelivery_providerId_idx" ON "NotificationDelivery"("providerId");
CREATE INDEX "NotificationDelivery_targetType_targetId_idx" ON "NotificationDelivery"("targetType", "targetId");

CREATE TABLE "EmailWebhookReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailWebhookReceipt_providerId_occurredAt_idx" ON "EmailWebhookReceipt"("providerId", "occurredAt");
