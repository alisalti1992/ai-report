-- AlterTable
ALTER TABLE "public"."crawl_pages" ADD COLUMN     "aiError" TEXT,
ADD COLUMN     "aiProcessed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiResponse" JSONB;
