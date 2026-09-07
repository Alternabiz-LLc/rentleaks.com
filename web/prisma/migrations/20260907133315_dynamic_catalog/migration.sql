-- AlterTable
ALTER TABLE "City" ADD COLUMN     "avgFurnished" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "avgRoom" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN     "countryName" TEXT NOT NULL DEFAULT 'United States',
ADD COLUMN     "group" TEXT NOT NULL DEFAULT 'United States',
ADD COLUMN     "neighborhoods" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "slug" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "detail" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaseEnd" TEXT,
ADD COLUMN     "maxStayMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "petsPolicy" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "privateBath" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remainingMonths" INTEGER,
ADD COLUMN     "scamShield" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "takeoverType" TEXT,
ADD COLUMN     "utilitiesIncl" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workplaceReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "City_slug_idx" ON "City"("slug");

-- CreateIndex
CREATE INDEX "City_country_idx" ON "City"("country");

-- CreateIndex
CREATE INDEX "Listing_allIn_idx" ON "Listing"("allIn");

-- CreateIndex
CREATE INDEX "Listing_availableFrom_idx" ON "Listing"("availableFrom");

-- CreateIndex
CREATE INDEX "Listing_featured_idx" ON "Listing"("featured");

-- CreateIndex
CREATE INDEX "Listing_housingType_cityId_idx" ON "Listing"("housingType", "cityId");
