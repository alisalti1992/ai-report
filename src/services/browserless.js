const puppeteer = require('puppeteer-core');
const axios = require('axios');

class BrowserlessService {
  constructor() {
    this.browserlessUrl = process.env.BROWSERLESS_URL;
    this.browserlessToken = process.env.BROWSERLESS_TOKEN;
    
    if (!this.browserlessUrl || !this.browserlessToken) {
      console.warn('Browserless URL or token not configured');
    }
  }

  async getBrowser() {
    if (!this.browserlessUrl || !this.browserlessToken) {
      throw new Error('Browserless configuration missing');
    }

    const wsEndpoint = `${this.browserlessUrl.replace('https://', 'wss://').replace('http://', 'ws://')}?token=${this.browserlessToken}`;
    
    return await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });
  }

  async crawlPage(url, options = {}) {
    const maxRetries = 3;
    const retryDelay = 2000; // Start with 2 seconds
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let browser;
      let page;
      
      try {
        browser = await this.getBrowser();
        page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Implement progressive wait strategy for retries
        const waitStrategy = this._getWaitStrategy(attempt);
        console.log(`Attempt ${attempt + 1}/${maxRetries + 1} for ${url} using wait strategy: ${waitStrategy.waitUntil}`);
        
        // Navigate to page with robust error handling
        const response = await this._navigateWithRetry(page, url, {
          ...waitStrategy,
          timeout: 120000 + (attempt * 10000), // Start with 2 minutes, increase on retries
          ...options
        });

        const finalUrl = page.url();
        const statusCode = response.status();
        
        // Wait for page to stabilize after navigation
        await this._waitForPageStability(page, attempt);
        
        // Get page content
        const title = await page.title();
        const html = await page.content();
        
        // Extract links if requested
        const links = options.extractLinks ? await page.$$eval('a[href]', anchors => 
          anchors.map(anchor => ({
            href: anchor.href,
            text: anchor.textContent?.trim()
          })).filter(link => link.href && !link.href.startsWith('javascript:'))
        ) : [];

        console.log(`Successfully crawled ${url} on attempt ${attempt + 1}`);
        return {
          url: finalUrl,
          originalUrl: url,
          statusCode,
          title,
          html,
          links,
          redirected: url !== finalUrl,
          attempt: attempt + 1
        };

      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed for ${url}:`, error.message);
        
        // Check if this is a retryable error
        if (!this._isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }
        
        // Progressive delay between retries
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`Retrying ${url} in ${delay}ms (attempt ${attempt + 2}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } finally {
        if (page) {
          try {
            await page.close();
          } catch (closeError) {
            console.warn(`Error closing page: ${closeError.message}`);
          }
        }
        if (browser) {
          try {
            await browser.disconnect();
          } catch (disconnectError) {
            console.warn(`Error disconnecting browser: ${disconnectError.message}`);
          }
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError;
  }

  async _navigateWithRetry(page, url, options) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      // Handle frame detachment specifically
      if (this._isFrameDetachedError(error)) {
        console.log(`Frame detached during navigation to ${url}, frame may be unusable - will retry with fresh browser instance`);
        // Don't attempt recovery on same page/frame - let the main retry loop handle it with a fresh browser instance
        throw error;
      }
      
      throw error;
    }
  }

  async _waitForPageStability(page, attempt) {
    try {
      // Progressive wait strategy - more conservative on retries
      const waitTime = 1000 + (attempt * 500);
      
      // Wait for basic page stability
      await page.waitForFunction(
        () => document.readyState === 'complete' || document.readyState === 'interactive',
        { timeout: 5000 }
      ).catch(() => {
        // If waiting for readyState fails, just use a time delay
        console.log('Document readyState check failed, using time delay');
      });
      
      // Additional stability wait
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
    } catch (error) {
      console.warn(`Page stability wait failed: ${error.message}`);
      // Don't throw here, as the page might still be usable
    }
  }

  _getWaitStrategy(attempt) {
    const strategies = [
      { waitUntil: 'networkidle2' }, // Start with the reliable method
      { waitUntil: 'domcontentloaded' }, // More lenient for retries
      { waitUntil: 'networkidle0' } // Most strict as final fallback
    ];
    
    return strategies[Math.min(attempt, strategies.length - 1)];
  }

  _isRetryableError(error) {
    const retryableErrors = [
      'navigating frame was detached',
      'attempted to use detached frame',
      'execution context was destroyed',
      'target closed',
      'session closed',
      'connection closed',
      'protocol error',
      'net::err_failed',
      'net::err_timed_out',
      'net::err_connection_reset',
      'net::err_connection_refused',
      'timeout'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  _isFrameDetachedError(error) {
    const frameDetachedPatterns = [
      'navigating frame was detached',
      'attempted to use detached frame',
      'frame was detached',
      'execution context was destroyed'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return frameDetachedPatterns.some(pattern => 
      errorMessage.includes(pattern)
    );
  }

  async checkUrlStatus(url) {
    try {
      const response = await axios.get(url, {
        maxRedirects: 5,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      return {
        statusCode: response.status,
        finalUrl: response.request.res.responseUrl || url,
        redirected: response.request.res.responseUrl !== url
      };
    } catch (error) {
      if (error.response) {
        return {
          statusCode: error.response.status,
          finalUrl: url,
          redirected: false,
          error: error.message
        };
      }
      throw error;
    }
  }

  async fetchRobotsTxt(baseUrl) {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).href;
      const response = await axios.get(robotsUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI Report Bot/1.0)'
        }
      });

      if (response.status === 200) {
        return {
          url: robotsUrl,
          content: response.data,
          found: true
        };
      }
      
      return { found: false };
    } catch (error) {
      console.log(`No robots.txt found at ${baseUrl}: ${error.message}`);
      return { found: false };
    }
  }

  async fetchSitemap(baseUrl, robotsContent = null) {
    let sitemapUrls = [];
    
    // First, try to find sitemap from robots.txt
    if (robotsContent) {
      const sitemapMatches = robotsContent.match(/sitemap:\s*(.+)/gi);
      if (sitemapMatches) {
        sitemapUrls = sitemapMatches.map(match => match.replace(/sitemap:\s*/i, '').trim());
      }
    }
    
    // Fallback to common sitemap locations
    if (sitemapUrls.length === 0) {
      sitemapUrls = [
        new URL('/sitemap.xml', baseUrl).href,
        new URL('/sitemap_index.xml', baseUrl).href
      ];
    }

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await axios.get(sitemapUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AI Report Bot/1.0)'
          }
        });

        if (response.status === 200) {
          return {
            url: sitemapUrl,
            content: response.data,
            found: true
          };
        }
      } catch (error) {
        console.log(`Sitemap not found at ${sitemapUrl}: ${error.message}`);
        continue;
      }
    }

    return { found: false };
  }

  extractHomepage(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Check if current URL looks like a homepage
      const homepagePatterns = [
        '/',
        '/home',
        '/homepage',
        '/index',
        '/index.html',
        '/index.php',
        '/en',
        '/eng',
        '/eng-au/homepage',
        '/en-us/homepage'
      ];
      
      const isHomepage = homepagePatterns.some(pattern => 
        pathname === pattern || pathname.endsWith(pattern)
      );
      
      if (isHomepage) {
        // Return the current URL as homepage
        return url;
      }
      
      // Otherwise, extract base domain
      return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch (error) {
      console.error('Error extracting homepage from URL:', error.message);
      throw error;
    }
  }
}

module.exports = new BrowserlessService();