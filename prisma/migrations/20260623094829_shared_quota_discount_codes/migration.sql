-- AlterTable
ALTER TABLE "DiscountCode" ADD COLUMN     "maxRedemptions" INTEGER,
ADD COLUMN     "redeemedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountRedemption_discountCodeId_idx" ON "DiscountRedemption"("discountCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountRedemption_discountCodeId_userId_key" ON "DiscountRedemption"("discountCodeId", "userId");

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
