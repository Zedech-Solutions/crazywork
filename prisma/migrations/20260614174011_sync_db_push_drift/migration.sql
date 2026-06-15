-- Baseline migration: captures schema changes that had been applied to dev via
-- `prisma db push` (no corresponding migration). Re-syncs the migration history
-- with schema.prisma so a fresh database (e.g. Neon prod) reproduces it exactly.
-- Non-destructive: only adds columns/tables/indexes and relaxes a constraint.

-- AlterEnum
ALTER TYPE "DiscountSource" ADD VALUE 'campaign';

-- AlterTable
ALTER TABLE "DiscountCode" ADD COLUMN     "amountOffSen" INTEGER,
ADD COLUMN     "batchLabel" TEXT,
ALTER COLUMN "issuedEmail" DROP NOT NULL,
ALTER COLUMN "percentage" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingPostcode" TEXT;

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "DiscountCode_batchLabel_idx" ON "DiscountCode"("batchLabel");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
