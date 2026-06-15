-- AlterTable
ALTER TABLE "Drop" ADD COLUMN     "featuredOnHome" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing "current" drops were the ones shown on the home page.
UPDATE "Drop" SET "featuredOnHome" = true WHERE "status" = 'current';
