const prisma = require('../lib/prisma');
const browserless = require('./browserless');
const sitemapParser = require('./sitemapParser');
const axios = require('axios');
const EmailService = require('./email');

class CrawlerService {
  constructor() {
    this.isRunning = false;
    this.processingJobs = new Set();
    this.intervalId = null;
    this.checkInterval = 30000; // Check every 30 seconds
    this.emailService = new EmailService();
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
      
      // Step 9: Send complete crawl data to AI webhook
      try {
        await this.sendCrawlCompletionToAI(job);
        console.log(`Crawl completion AI webhook completed for job ${job.id}`);
      } catch (error) {
        console.error(`Crawl completion AI webhook failed for job ${job.id}:`, error.message);
        // Don't fail the entire job if crawl completion webhook fails
        // The error is already stored in the database by sendCrawlCompletionToAI
      }
      
      return job;
    } catch (error) {
      console.error(`Error starting crawl job ${jobId}:`, error);
      
      // Update job status to failed with error details
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { 
          status: 'failed',
          error: error.message,
          errorDetails: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        }
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
      
      // Update job with step failure info
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: { 
          failedStep: 'url_homepage',
          error: `URL/Homepage processing failed: ${error.message}`
        }
      }).catch(console.error);
      
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
      
      // Update job with step failure info
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: { 
          failedStep: 'robots_txt',
          error: `Robots.txt processing failed: ${error.message}`
        }
      }).catch(console.error);
      
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
      
      // Update job with step failure info
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: { 
          failedStep: 'sitemap_xml',
          error: `Sitemap.xml processing failed: ${error.message}`
        }
      }).catch(console.error);
      
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
      let aiWebhookSuccessful = 0;
      let aiWebhookFailed = 0;
      let aiWebhookSkipped = 0;
      
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
            const crawledPage = await prisma.crawlPage.create({
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
            
            // Send page to AI webhook for real-time analysis
            let aiSuccess = false;
            let aiResult = null;
            try {
              aiResult = await this.sendPageToAIWebhook(updatedJob, crawledPage);
              
              // Update page with AI webhook results
              const aiUpdateData = {
                aiProcessed: true
              };
              
              if (aiResult && aiResult.success) {
                console.log(`Page sent to AI webhook successfully: ${url.loc}`);
                aiSuccess = true;
                aiUpdateData.aiResponse = aiResult.data;
              } else if (aiResult && !aiResult.success) {
                if (aiResult.skipped) {
                  console.log(`AI webhook skipped for ${url.loc}: ${aiResult.error}`);
                } else {
                  console.warn(`AI webhook failed for ${url.loc}: ${aiResult.error}`);
                }
                aiUpdateData.aiError = aiResult.error;
              }
              
              // Update the crawled page with AI webhook results
              await prisma.crawlPage.update({
                where: { id: crawledPage.id },
                data: aiUpdateData
              });
              
            } catch (aiError) {
              console.error(`Error sending page to AI webhook ${url.loc}:`, aiError.message);
              
              // Store AI error in database
              await prisma.crawlPage.update({
                where: { id: crawledPage.id },
                data: {
                  aiProcessed: true,
                  aiError: aiError.message
                }
              }).catch(updateError => {
                console.error(`Failed to update page with AI error:`, updateError.message);
              });
              
              // Don't fail the entire crawl if AI webhook fails
            }
            
            return { 
              success: true, 
              url: url.loc, 
              aiSuccess, 
              aiSkipped: aiResult?.skipped || false
            };
            
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
            
            return { success: false, url: url.loc, error: error.message, aiSuccess: false, aiSkipped: false };
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Count results
        const batchSuccess = batchResults.filter(r => r.success).length;
        const batchFailed = batchResults.filter(r => !r.success).length;
        const batchAISuccess = batchResults.filter(r => r.aiSuccess).length;
        const batchAISkipped = batchResults.filter(r => r.aiSkipped).length;
        const batchAIFailed = batchResults.filter(r => r.success && !r.aiSuccess && !r.aiSkipped).length;
        
        totalCrawled += batchSuccess;
        totalFailed += batchFailed;
        aiWebhookSuccessful += batchAISuccess;
        aiWebhookSkipped += batchAISkipped;
        aiWebhookFailed += batchAIFailed;
        
        console.log(`Batch completed: ${batchSuccess} success, ${batchFailed} failed, AI: ${batchAISuccess} success, ${batchAIFailed} failed, ${batchAISkipped} skipped`);
        
        // Small delay between batches to be respectful
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`Completed crawling sample pages for job ${job.id}: ${totalCrawled} success, ${totalFailed} failed`);
      console.log(`AI webhook results for job ${job.id}: ${aiWebhookSuccessful} success, ${aiWebhookFailed} failed, ${aiWebhookSkipped} skipped`);
      
      // Update job with crawl statistics
      const completedJob = await prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          crawlStats: {
            totalPages: urls.length,
            successfulPages: totalCrawled,
            failedPages: totalFailed,
            aiWebhook: {
              successful: aiWebhookSuccessful,
              failed: aiWebhookFailed,
              skipped: aiWebhookSkipped,
              total: totalCrawled, // Only successful crawls are sent to AI
              enabled: !!process.env.AI_PAGE_ANALYZER_HOOK
            },
            crawlCompletionWebhook: {
              enabled: !!process.env.AI_CRAWL_ANALYZER_HOOK
            },
            completedAt: new Date().toISOString()
          }
        }
      });
      
      console.log(`Job ${job.id} marked as completed with crawl statistics`);
      
      // Send completion email notification
      try {
        await this.emailService.sendCompletionEmail(
          completedJob.email,
          completedJob.id,
          completedJob.url,
          {
            totalPages: totalCrawled,
            completedPages: aiWebhookSuccessful,
            reportUrl: `${process.env.BASE_APP_URL || 'http://localhost:5555'}/report/${completedJob.id}`
          }
        );
        console.log(`Completion email sent to ${completedJob.email} for job ${completedJob.id}`);
      } catch (emailError) {
        console.error('Error sending completion email:', emailError);
        // Don't fail the job completion if email fails
      }
      
    } catch (error) {
      console.error(`Error crawling sample pages for job ${job.id}:`, error);
      
      // Update job with step failure info
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: { 
          status: 'failed',
          failedStep: 'crawl_pages',
          error: `Page crawling failed: ${error.message}`,
          errorDetails: {
            message: error.message,
            stack: error.stack,
            step: 'crawl_pages',
            timestamp: new Date().toISOString()
          }
        }
      }).catch(console.error);
      
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
        if (sampleSitemap.firstLevelPages) {
          console.log(`First-level pages: ${sampleSitemap.firstLevelPages.crawled} crawled out of ${sampleSitemap.firstLevelPages.total} total`);
        }
        
      } else {
        const firstLevelLimit = parseInt(process.env.CRAWL_FIRST_LEVEL_LIMIT) || 10;
        console.log('No sitemap.xml found, crawling homepage for links');
        
        // Crawl homepage to discover links
        const homepageResult = await browserless.crawlPage(updatedJob.homepage, {
          extractLinks: true
        });
        
        console.log(`Found ${homepageResult.links.length} links on homepage`);
        
        // Process discovered links to create sample sitemap
        const sampleResult = await this.createSampleFromHomepageLinks(
          updatedJob.homepage, 
          homepageResult.links
        );
        
        const sampleSitemap = {
          urls: sampleResult.urls,
          categories: this.categorizeSampleUrls(sampleResult.urls),
          firstLevelPages: sampleResult.firstLevelPages,
          totalOriginalUrls: sampleResult.urls.length,
          crawlingLimits: {
            firstLevelLimit: firstLevelLimit,
            maxPerCategory: 2
          },
          fallback: true,
          source: 'homepage_crawl'
        };
        
        await prisma.crawlJob.update({
          where: { id: job.id },
          data: {
            sampleSitemap: sampleSitemap
          }
        });
        
        console.log(`Created sample sitemap from homepage crawl with ${sampleResult.urls.length} URLs`);
        console.log(`First-level pages: ${sampleResult.firstLevelPages.crawled} crawled out of ${sampleResult.firstLevelPages.total} total`);
      }
      
    } catch (error) {
      console.error(`Error creating sample sitemap for job ${job.id}:`, error);
      
      // Update job with step failure info
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: { 
          failedStep: 'sample_sitemap',
          error: `Sample sitemap creation failed: ${error.message}`
        }
      }).catch(console.error);
      
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
    const firstLevelLimit = parseInt(process.env.CRAWL_FIRST_LEVEL_LIMIT) || 10;
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
    
    // Separate first-level and deeper level pages
    const firstLevelLinks = processedLinks.filter(link => link.level === 1);
    const deeperLevelLinks = processedLinks.filter(link => link.level > 1);
    
    // Limit first-level pages based on environment variable
    const limitedFirstLevel = firstLevelLinks.slice(0, firstLevelLimit);
    
    // Add remaining capacity with deeper level pages
    const remainingCapacity = Math.max(0, 20 - limitedFirstLevel.length - 1); // -1 for homepage
    const selectedDeeperLevel = deeperLevelLinks.slice(0, remainingCapacity);
    
    // Combine limited first-level and selected deeper level
    const selectedLinks = [...limitedFirstLevel, ...selectedDeeperLevel];
    sampleUrls.push(...selectedLinks);
    
    console.log(`Selected ${selectedLinks.length} links from homepage crawl (${limitedFirstLevel.length} first-level, ${selectedDeeperLevel.length} deeper)`);
    console.log(`First-level pages limited to ${firstLevelLimit} from ${firstLevelLinks.length} available`);
    
    return {
      urls: sampleUrls,
      firstLevelPages: {
        total: firstLevelLinks.length,
        crawled: limitedFirstLevel.length,
        allPages: firstLevelLinks.map(url => ({
          url: url.loc,
          title: url.linkText,
          level: url.level,
          pathname: url.pathname,
          priority: url.priority,
          changefreq: url.changefreq,
          lastmod: url.lastmod
        }))
      }
    };
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

  async sendPageToAIWebhook(job, page, retryCount = 0) {
    const aiWebhookUrl = process.env.AI_PAGE_ANALYZER_HOOK;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    if (!aiWebhookUrl) {
      console.log('AI_PAGE_ANALYZER_HOOK not configured, skipping AI analysis');
      return {
        success: false,
        error: 'AI webhook not configured',
        skipped: true
      };
    }

    try {
      console.log(`Sending page to AI webhook: ${page.url}`);
      
      const webhookPayload = {
        jobId: job.id,
        jobEmail: job.email,
        jobUrl: job.url,
        homepage: job.homepage,
        page: {
          id: page.id,
          url: page.url,
          title: page.title,
          html: page.html,
          statusCode: page.statusCode,
          level: page.level,
          pathname: page.pathname,
          segments: page.segments,
          priority: page.priority,
          changefreq: page.changefreq,
          lastmod: page.lastmod,
          crawledAt: page.crawledAt
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'ai-report-crawler',
          version: '1.0'
        }
      };

      const response = await axios.post(aiWebhookUrl, webhookPayload, {
        timeout: 120000, // 2 minutes
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Report-Crawler/1.0'
        }
      });

      console.log(`AI webhook response for ${page.url}: ${response.status}`);
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`AI webhook failed for ${page.url} (attempt ${retryCount + 1}):`, error.message);
      
      // Retry logic for temporary failures
      if (retryCount < maxRetries && (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        (error.response && error.response.status >= 500)
      )) {
        console.log(`Retrying AI webhook for ${page.url} in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.sendPageToAIWebhook(job, page, retryCount + 1);
      }

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 0,
        retryCount: retryCount + 1,
        timestamp: new Date().toISOString()
      };
    }
  }

  async sendCrawlCompletionToAI(job, retryCount = 0) {
    const aiWebhookUrl = process.env.AI_CRAWL_ANALYZER_HOOK;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    if (!aiWebhookUrl) {
      console.log('AI_CRAWL_ANALYZER_HOOK not configured, skipping crawl completion analysis');
      return null;
    }

    try {
      // Get the complete job data with all crawled pages
      const completeJob = await prisma.crawlJob.findUnique({
        where: { id: job.id },
        include: {
          pages: {
            select: {
              id: true,
              url: true,
              title: true,
              statusCode: true,
              redirected: true,
              finalUrl: true,
              level: true,
              pathname: true,
              segments: true,
              priority: true,
              changefreq: true,
              lastmod: true,
              aiResponse: true,
              aiError: true,
              aiProcessed: true,
              crawledAt: true
            }
          }
        }
      });

      if (!completeJob) {
        throw new Error('Job not found for crawl completion');
      }

      console.log(`Sending crawl completion data to AI webhook for job ${job.id}`);
      
      // Prepare the crawl completion payload
      const crawlCompletionPayload = {
        jobId: completeJob.id,
        jobEmail: completeJob.email,
        originalUrl: completeJob.url,
        crawlInfo: {
          homepage: completeJob.homepage,
          status: completeJob.status,
          createdAt: completeJob.createdAt,
          updatedAt: completeJob.updatedAt,
          crawlStats: completeJob.crawlStats
        },
        robotsTxt: completeJob.robotsTxt,
        sampleSitemap: completeJob.sampleSitemap,
        crawledPages: completeJob.pages.map(page => ({
          id: page.id,
          url: page.url,
          title: page.title,
          statusCode: page.statusCode,
          redirected: page.redirected,
          finalUrl: page.finalUrl,
          level: page.level,
          pathname: page.pathname,
          segments: page.segments,
          priority: page.priority,
          changefreq: page.changefreq,
          lastmod: page.lastmod,
          aiResponse: page.aiResponse, // AI analysis results from individual page processing
          aiError: page.aiError,
          aiProcessed: page.aiProcessed,
          crawledAt: page.crawledAt
        })),
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'ai-report-crawler',
          version: '1.0',
          completionType: 'full_crawl'
        }
      };

      const response = await axios.post(aiWebhookUrl, crawlCompletionPayload, {
        timeout: 120000, // 2 minutes for completion webhook
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Report-Crawler/1.0'
        }
      });

      console.log(`Crawl completion AI webhook response for job ${job.id}: ${response.status}`);
      
      // Store the crawl completion AI response in job
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          crawlCompletionAI: {
            success: true,
            status: response.status,
            response: response.data,
            timestamp: new Date().toISOString()
          }
        }
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Crawl completion AI webhook failed for job ${job.id} (attempt ${retryCount + 1}):`, error.message);
      
      // Retry logic for temporary failures
      if (retryCount < maxRetries && (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        (error.response && error.response.status >= 500)
      )) {
        console.log(`Retrying crawl completion AI webhook for job ${job.id} in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.sendCrawlCompletionToAI(job, retryCount + 1);
      }

      // Store the crawl completion AI error in job
      await prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          crawlCompletionAI: {
            success: false,
            error: error.message,
            status: error.response?.status || 0,
            retryCount: retryCount + 1,
            timestamp: new Date().toISOString()
          }
        }
      }).catch(updateError => {
        console.error(`Failed to store crawl completion AI error:`, updateError.message);
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 0,
        retryCount: retryCount + 1,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new CrawlerService();