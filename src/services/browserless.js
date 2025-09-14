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
    let browser;
    let page;
    
    try {
      browser = await this.getBrowser();
      page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
        ...options
      });

      const finalUrl = page.url();
      const statusCode = response.status();
      
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

      return {
        url: finalUrl,
        originalUrl: url,
        statusCode,
        title,
        html,
        links,
        redirected: url !== finalUrl
      };

    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
      throw error;
    } finally {
      if (page) await page.close();
      if (browser) await browser.disconnect();
    }
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