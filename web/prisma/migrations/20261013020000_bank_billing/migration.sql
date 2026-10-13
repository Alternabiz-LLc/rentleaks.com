CREATE TABLE "BankSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "listingId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL, "customerId" TEXT, "planId" TEXT NOT NULL,
  "sponsored" BOOLEAN NOT NULL DEFAULT false, "quote" JSONB NOT NULL, "amountCents" INTEGER NOT NULL,
  "hostedPageId" TEXT, "hostedUrl" TEXT, "checkoutExpiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'checkout_pending', "access" TEXT NOT NULL DEFAULT 'basic',
  "paidThrough" TIMESTAMP(3), "invoiceId" TEXT, "snapshotVersion" BIGINT NOT NULL DEFAULT 0,
  "lastEventAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BankSubscription_listingId_key" ON "BankSubscription"("listingId");
CREATE UNIQUE INDEX "BankSubscription_providerId_key" ON "BankSubscription"("providerId");
CREATE INDEX "BankSubscription_userId_idx" ON "BankSubscription"("userId");
ALTER TABLE "BankSubscription" ADD CONSTRAINT "BankSubscription_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "BankBillingEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BankBillingEvent_providerId_idx" ON "BankBillingEvent"("providerId");
