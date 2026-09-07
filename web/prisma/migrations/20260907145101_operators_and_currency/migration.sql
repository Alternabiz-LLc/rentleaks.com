-- DropIndex
DROP INDEX "Listing_allIn_idx";

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "allInUsd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "operatorId" TEXT;

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "since" INTEGER,
    "scope" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operator_slug_key" ON "Operator"("slug");

-- CreateIndex
CREATE INDEX "Operator_kind_idx" ON "Operator"("kind");

-- CreateIndex
CREATE INDEX "Listing_operatorId_idx" ON "Listing"("operatorId");

-- CreateIndex
CREATE INDEX "Listing_allInUsd_idx" ON "Listing"("allInUsd");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
