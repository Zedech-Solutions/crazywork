-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'image';
