-- CreateTable
CREATE TABLE "public"."crawl_jobs" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "homepage" TEXT,
    "robotsTxt" TEXT,
    "sitemapXml" TEXT,
    "sampleSitemap" JSONB,
    "crawlStats" JSONB,
    "error" TEXT,
    "errorDetails" JSONB,
    "failedStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crawl_pages" (
    "id" TEXT NOT NULL,
    "crawl_job_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "html" TEXT,
    "statusCode" INTEGER,
    "redirected" BOOLEAN NOT NULL DEFAULT false,
    "finalUrl" TEXT,
    "level" INTEGER,
    "pathname" TEXT,
    "segments" JSONB,
    "priority" DOUBLE PRECISION,
    "changefreq" TEXT,
    "lastmod" TEXT,
    "error" TEXT,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_pages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."crawl_pages" ADD CONSTRAINT "crawl_pages_crawl_job_id_fkey" FOREIGN KEY ("crawl_job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
