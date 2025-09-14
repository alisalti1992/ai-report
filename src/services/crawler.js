const prisma = require('../lib/prisma');
const browserless = require('./browserless');
const sitemapParser = require('./sitemapParser');

class CrawlerService {
  constructor() {
    this.isRunning = false;
    this.processingJobs = new Set();
    this.intervalId = null;
    this.checkInterval = 30000; // Check every 30 seconds
  }

  async findVerifiedJobs() {
    try {
      const jobs = await prisma.crawlJob.findMany({
        where: {
          verified: true,
          cancelled: false,
          status: 'verified'
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      console.log(`Found ${jobs.length} verified jobs ready for processing`);
      return jobs;
    } catch (error) {
      console.error('Error finding verified jobs:', error);
      throw error;
    }
  }

  async startCrawlJob(jobId) {
    if (this.processingJobs.has(jobId)) {
      console.log(`Job ${jobId} is already being processed`);
      return;
    }

    this.processingJobs.add(jobId);

    try {
      // Update job status to processing
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { status: 'processing' }
      });

      console.log(`Started processing crawl job: ${jobId}`);

      const job = await prisma.crawlJob.findUnique({
        where: { id: jobId }
      });

      if (!job) {
        throw new Error('Job not found');
      }

      console.log(`Processing job: ${job.url} for ${job.email}`);
      
      // Step 4: Check URL status and get homepage
      await this.processUrlAndHomepage(job);
      
      // Step 5: Find and store robots.txt
      await this.processRobotsTxt(job);
      
      // Step 6: Find and store sitemap.xml
      await this.processSitemapXml(job);
      
      // Step 7: Create sample sitemap
      await this.createSampleSitemap(job);
      
      // Step 8: Crawl all pages in sample sitemap
      await this.crawlSamplePages(job);
      
      return job;
    } catch (error) {
      console.error(`Error starting crawl job ${jobId}:`, error);
      
      // Update job status to failed
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { status: 'failed' }
      }).catch(console.error);
      
      throw error;
    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  async processUrlAndHomepage(job) {
    try {
      console.log(`Checking URL status for: ${job.url}`);
      
      // Check URL status and handle redirects
      const urlStatus = await browserless.checkUrlStatus(job.url);
      console.log(`URL status: ${urlStatus.statusCode}, Final URL: ${urlStatus.finalUrl}`);
      
      if (urlStatus.statusCode >= 400) {
        throw new Error(`URL returned ${urlStatus.statusCode}: ${urlStatus.error || 'Not accessible'}`);
      }
      
      // Extract homepage from final URL
      const homepage = browserless.extractHomepage(urlStatus.finalUrl);
      console.log(`Extracted homepage: ${homepage}`);
      
      // Update job with homepage information
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          homepage: homepage
        }
      });
      
      console.log(`Updated job ${job.id} with homepage: ${homepage}`);
      
    } catch (error) {
      console.error(`Error processing URL and homepage for job ${job.id}:`, error);
      throw error;
    }
  }

  async processRobotsTxt(job) {
    try {
      // Get the updated job with homepage
      const updatedJob = await prisma.crawlJob.findUnique({
        where: { id: job.id }
      });
      
      if (!updatedJob || !updatedJob.homepage) {
        throw new Error('Homepage not found for robots.txt processing');
      }
      
      console.log(`Fetching robots.txt for: ${updatedJob.homepage}`);
      
      // Fetch robots.txt from homepage
      const robotsResult = await browserless.fetchRobotsTxt(updatedJob.homepage);
      
      if (robotsResult.found) {
        console.log(`Found robots.txt at: ${robotsResult.url}`);
        console.log(`Robots.txt size: ${robotsResult.content.length} characters`);
        
        // Update job with robots.txt content
        await prisma.crawlJob.update({
          where: { id: job.id },
          data: {
            robotsTxt: robotsResult.content
          }
        });
        
        console.log(`Stored robots.txt for job ${job.id}`);
      } else {
        console.log(`No robots.txt found for: ${updatedJob.homepage}`);
        
        // Update with null to indicate we checked but didn't find it
        await prisma.crawlJob.update({
          where: { id: job.id },
          data: {
            robotsTxt: null
          }
        });
      }
      
    } catch (error) {
      console.error(`Error processing robots.txt for job ${job.id}:`, error);
      throw error;
    }
  }

  async processSitemapXml(job) {
    try {
      // Get the updated job with homepage and robots.txt
      const updatedJob = await prisma.crawlJob.findUnique({
        where: { id: job.id }
      });
      
      if (!updatedJob || !updatedJob.homepage) {
        throw new Error('Homepage not found for sitemap.xml processing');
      }
      
      console.log(`Fetching sitemap.xml for: ${updatedJob.homepage}`);
      
      // Fetch sitemap.xml using robots.txt content if available
      const sitemapResult = await browserless.fetchSitemap(
        updatedJob.homepage, 
        updatedJob.robotsTxt
      );
      
      if (sitemapResult.found) {
        console.log(`Found sitemap.xml at: ${sitemapResult.url}`);
        console.log(`Sitemap.xml size: ${sitemapResult.content.length} characters`);
        
        // Update job with sitemap.xml content
        await prisma.crawlJob.update({
          where: { id: job.id },
          data: {
            sitemapXml: sitemapResult.content
          }
        });
        
        console.log(`Stored sitemap.xml for job ${job.id}`);
      } else {
        console.log(`No sitemap.xml found for: ${updatedJob.homepage}`);
        
        // Update with null to indicate we checked but didn't find it
        await prisma.crawlJob.update({
          where: { id: job.id },
          data: {
            sitemapXml: null
          }
        });
      }
      
    } catch (error) {
      console.error(`Error processing sitemap.xml for job ${job.id}:`, error);
      throw error;
    }
  }

  async crawlSamplePages(job) {
    try {
      // Get the updated job with sample sitemap
      const updatedJob = await prisma.crawlJob.findUnique({
        where: { id: job.id }
      });
      
      if (!updatedJob || !updatedJob.sampleSitemap) {
        throw new Error('Sample sitemap not found for page crawling');
      }
      
      console.log(`Starting to crawl sample pages for job ${job.id}`);
      
      const sampleSitemap = updatedJob.sampleSitemap;
      const urls = sampleSitemap.urls || [];
      
      console.log(`Crawling ${urls.length} pages from sample sitemap`);
      
      // Process pages in batches to avoid overwhelming the system
      const batchSize = 3;
      const batches = [];
      for (let i = 0; i < urls.length; i += batchSize) {
        batches.push(urls.slice(i, i + batchSize));
      }
      
      let totalCrawled = 0;
      let totalFailed = 0;
      
      for (const batch of batches) {
        console.log(`Processing batch of ${batch.length} pages`);
        
        // Process batch pages in parallel
        const batchPromises = batch.map(async (url) => {
          try {
            console.log(`Crawling page: ${url.loc}`);
            
            // Crawl the page using browserless
            const pageResult = await browserless.crawlPage(url.loc, {
              extractLinks: false // We don't need links for stored pages
            });
            
            // Store the crawled page in database
            await prisma.crawlPage.create({
              data: {
                crawlJobId: job.id,
                url: url.loc,
                title: pageResult.title,
                html: pageResult.html,
                statusCode: pageResult.statusCode,
                redirected: pageResult.redirected,
                finalUrl: pageResult.url,
                level: url.level || 0,
                pathname: url.pathname || new URL(url.loc).pathname,
                segments: url.segments || [],
                priority: url.priority,
                changefreq: url.changefreq,
                lastmod: url.lastmod
              }
            });
            
            console.log(`Successfully crawled and stored: ${url.loc}`);
            return { success: true, url: url.loc };
            
          } catch (error) {
            console.error(`Failed to crawl page ${url.loc}:`, error.message);
            
            // Store failed page with error info
            await prisma.crawlPage.create({
              data: {
                crawlJobId: job.id,
                url: url.loc,
                title: null,
                html: null,
                statusCode: 0,
                redirected: false,
                finalUrl: url.loc,
                level: url.level || 0,
                pathname: url.pathname || new URL(url.loc).pathname,
                segments: url.segments || [],
                priority: url.priority,
                changefreq: url.changefreq,
                lastmod: url.lastmod,
                error: error.message
              }
            }).catch(dbError => {
              console.error(`Failed to store error for ${url.loc}:`, dbError.message);
            });
            
            return { success: false, url: url.loc, error: error.message };
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Count results
        const batchSuccess = batchResults.filter(r => r.success).length;
        const batchFailed = batchResults.filter(r => !r.success).length;
        
        totalCrawled += batchSuccess;
        totalFailed += batchFailed;
        
        console.log(`Batch completed: ${batchSuccess} success, ${batchFailed} failed`);
        
        // Small delay between batches to be respectful
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`Completed crawling sample pages for job ${job.id}: ${totalCrawled} success, ${totalFailed} failed`);
      
      // Update job with crawl statistics
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          crawlStats: {
            totalPages: urls.length,
            successfulPages: totalCrawled,
            failedPages: totalFailed,
            completedAt: new Date().toISOString()
          }
        }
      });
      
      console.log(`Job ${job.id} marked as completed with crawl statistics`);
      
    } catch (error) {
      console.error(`Error crawling sample pages for job ${job.id}:`, error);
      throw error;
    }
  }

  async createSampleSitemap(job) {
    try {
      // Get the updated job with sitemap data
      const updatedJob = await prisma.crawlJob.findUnique({
        where: { id: job.id }
      });
      
      if (!updatedJob || !updatedJob.homepage) {
        throw new Error('Homepage not found for sample sitemap creation');
      }
      
      console.log(`Creating sample sitemap for job ${job.id}`);
      
      if (updatedJob.sitemapXml) {
        console.log('Processing sitemap.xml to create sample');
        
        // Parse sitemap.xml and create sample
        const urls = await sitemapParser.parseSitemap(updatedJob.sitemapXml, updatedJob.homepage);
        console.log(`Found ${urls.length} URLs in sitemap.xml`);
        
        const categories = sitemapParser.categorizeUrls(urls, updatedJob.homepage);
        console.log('Auto-detected URL categories:', Object.fromEntries(
          Object.entries(categories).map(([key, value]) => [key, value.length])
        ));
        
        const sampleSitemap = sitemapParser.createSampleSitemap(categories, 2);
        
        // Store sample sitemap in database
        await prisma.crawlJob.update({
          where: { id: job.id },
          data: {
            sampleSitemap: sampleSitemap
          }
        });
        
        console.log(`Created sample sitemap with ${sampleSitemap.urls.length} URLs from ${sampleSitemap.totalOriginalUrls} total URLs`);
        
      } else {
        console.log('No sitemap.xml found, crawling homepage for links');
        
        // Crawl homepage to discover links
        const homepageResult = await browserless.crawlPage(updatedJob.homepage, {
          extractLinks: true
        });
        
        console.log(`Found ${homepageResult.links.length} links on homepage`);
        
        // Process discovered links to create sample sitemap
        const sampleUrls = await this.createSampleFromHomepageLinks(
          updatedJob.homepage, 
          homepageResult.links
        );
        
        const sampleSitemap = {
          urls: sampleUrls,
          categories: this.categorizeSampleUrls(sampleUrls),
          totalOriginalUrls: sampleUrls.length,
          fallback: true,
          source: 'homepage_crawl'
        };
        
        await prisma.crawlJob.update({
          where: { id: job.id },
          data: {
            sampleSitemap: sampleSitemap
          }
        });
        
        console.log(`Created sample sitemap from homepage crawl with ${sampleUrls.length} URLs`);
      }
      
    } catch (error) {
      console.error(`Error creating sample sitemap for job ${job.id}:`, error);
      throw error;
    }
  }

  async processVerifiedJobs() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const jobs = await this.findVerifiedJobs();
      
      if (jobs.length === 0) {
        return;
      }

      console.log(`Processing ${jobs.length} verified jobs...`);

      // Process jobs one by one to avoid overwhelming the system
      for (const job of jobs) {
        try {
          await this.startCrawlJob(job.id);
        } catch (error) {
          console.error(`Failed to process job ${job.id}:`, error);
          // Continue with next job
        }
      }

    } catch (error) {
      console.error('Error in crawler service:', error);
    } finally {
      this.isRunning = false;
    }
  }

  startBackgroundProcessor() {
    if (this.intervalId) {
      console.log('Background crawler processor already running');
      return;
    }

    console.log('Starting background crawler processor...');
    
    // Process immediately on start
    this.processVerifiedJobs().catch(console.error);
    
    // Set up interval to check for new jobs
    this.intervalId = setInterval(() => {
      this.processVerifiedJobs().catch(console.error);
    }, this.checkInterval);

    console.log(`Background crawler processor started (checking every ${this.checkInterval/1000}s)`);
  }

  stopBackgroundProcessor() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Background crawler processor stopped');
    }
  }

  async getJobStatus(jobId) {
    try {
      const job = await prisma.crawlJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          url: true,
          email: true,
          status: true,
          verified: true,
          cancelled: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return job;
    } catch (error) {
      console.error(`Error getting job status for ${jobId}:`, error);
      throw error;
    }
  }

  isJobProcessing(jobId) {
    return this.processingJobs.has(jobId);
  }

  getProcessingJobsCount() {
    return this.processingJobs.size;
  }

  async createSampleFromHomepageLinks(homepage, links) {
    const baseUrlObj = new URL(homepage);
    const sampleUrls = [];
    
    // Always include homepage
    sampleUrls.push({
      loc: homepage,
      lastmod: null,
      changefreq: null,
      priority: 1.0,
      level: 0,
      pathname: '/',
      segments: []
    });
    
    // Process discovered links
    const processedLinks = [];
    
    for (const link of links) {
      try {
        const linkUrl = new URL(link.href);
        
        // Skip external links
        if (linkUrl.hostname !== baseUrlObj.hostname) {
          continue;
        }
        
        // Skip common non-content links
        if (this.shouldSkipLink(linkUrl.pathname)) {
          continue;
        }
        
        const pathname = linkUrl.pathname.toLowerCase();
        const segments = pathname.split('/').filter(s => s);
        const level = segments.length;
        
        processedLinks.push({
          loc: linkUrl.href,
          lastmod: null,
          changefreq: null,
          priority: null,
          level,
          pathname,
          segments,
          linkText: link.text || ''
        });
      } catch (error) {
        // Skip invalid URLs
        continue;
      }
    }
    
    // Sort by level (prioritize top-level pages) and limit
    processedLinks.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return a.loc.localeCompare(b.loc);
    });
    
    // Take a reasonable sample (max 20 links)
    const selectedLinks = processedLinks.slice(0, 20);
    sampleUrls.push(...selectedLinks);
    
    console.log(`Selected ${selectedLinks.length} links from homepage crawl`);
    
    return sampleUrls;
  }

  shouldSkipLink(pathname) {
    const skipPatterns = [
      /\.(jpg|jpeg|png|gif|svg|pdf|doc|docx|zip|exe)$/i,
      /^\/wp-admin/,
      /^\/admin/,
      /^\/login/,
      /^\/register/,
      /^\/cart/,
      /^\/checkout/,
      /^\/account/,
      /^\/search/,
      /^\/#/,
      /^\/mailto:/,
      /^\/tel:/,
      /^javascript:/
    ];
    
    return skipPatterns.some(pattern => pattern.test(pathname));
  }

  categorizeSampleUrls(urls) {
    const categories = {
      homepage: 0,
      other: 0
    };
    
    const urlsByPattern = new Map();
    
    for (const url of urls) {
      if (url.level === 0) {
        categories.homepage++;
      } else if (url.segments.length > 0) {
        const firstSegment = url.segments[0];
        if (!urlsByPattern.has(firstSegment)) {
          urlsByPattern.set(firstSegment, 0);
        }
        urlsByPattern.get(firstSegment)++;
      } else {
        categories.other++;
      }
    }
    
    // Add detected patterns to categories
    for (const [pattern, count] of urlsByPattern.entries()) {
      if (count >= 1) {
        categories[pattern] = count;
      }
    }
    
    return categories;
  }
}

module.exports = new CrawlerService();