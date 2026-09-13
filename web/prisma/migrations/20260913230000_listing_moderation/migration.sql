-- Listing review.
--
-- Separate from `status` deliberately. `status` is the seller's switch —
-- active, coming-soon, paused — and `moderation` is ours, so a seller cannot
-- unpause their way past a decline.
--
-- Everything already in the catalogue is backfilled to 'approved'. Defaulting
-- existing rows to 'pending' would empty the public site the moment the gate
-- in liveListingWhere() starts filtering, which is the kind of migration that
-- looks fine in review and takes production down.

ALTER TABLE "Listing" ADD COLUMN "moderation" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Listing" ADD COLUMN "moderationNote" TEXT;
ALTER TABLE "Listing" ADD COLUMN "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "moderatedById" TEXT;

UPDATE "Listing" SET "moderation" = 'approved', "moderatedAt" = NOW();

CREATE INDEX "Listing_moderation_idx" ON "Listing"("moderation");
