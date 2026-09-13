-- Composer fields.
--
-- Real columns where something filters, sorts or ranks on the value; JSON
-- strings for arrays that only ever render. `availableUntil` is the one that
-- matters most: without an end date, "available March through June" is not a
-- question this catalogue can answer, which is the whole point of a mid-term
-- marketplace.

ALTER TABLE "Listing" ADD COLUMN     "availableUntil" TEXT;
ALTER TABLE "Listing" ADD COLUMN     "listedBy" TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE "Listing" ADD COLUMN     "addressPrivacy" TEXT NOT NULL DEFAULT 'street-only';
ALTER TABLE "Listing" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Listing" ADD COLUMN     "scheduledAt" TEXT;
ALTER TABLE "Listing" ADD COLUMN     "vouchersAccepted" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Listing" ADD COLUMN     "registrationNumber" TEXT;
ALTER TABLE "Listing" ADD COLUMN     "consentStatus" TEXT;
ALTER TABLE "Listing" ADD COLUMN     "accessibilityJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Listing" ADD COLUMN     "feesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Listing" ADD COLUMN     "sponsored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Listing" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'week';

-- Existing rows get a window rather than a null, so date-range search does not
-- silently exclude the whole back catalogue the day it ships.
UPDATE "Listing"
   SET "availableUntil" = to_char(
         (("availableFrom")::date + ("maxStayMonths" || ' months')::interval),
         'YYYY-MM-DD'
       )
 WHERE "availableUntil" IS NULL
   AND "availableFrom" ~ '^\d{4}-\d{2}-\d{2}$';

CREATE INDEX "Listing_availableUntil_idx" ON "Listing"("availableUntil");
CREATE INDEX "Listing_status_idx" ON "Listing"("status");
CREATE INDEX "Listing_sponsored_cityId_idx" ON "Listing"("sponsored", "cityId");
CREATE INDEX "Listing_vouchersAccepted_idx" ON "Listing"("vouchersAccepted");
