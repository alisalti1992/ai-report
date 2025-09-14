const xml2js = require('xml2js');
const axios = require('axios');

class SitemapParserService {
  constructor() {
    this.parser = new xml2js.Parser();
  }

  async parseSitemap(sitemapContent, baseUrl) {
    try {
      const result = await this.parser.parseStringPromise(sitemapContent);
      
      // Check if this is a sitemap index (contains multiple sitemaps)
      if (result.sitemapindex) {
        return await this.parseSitemapIndex(result.sitemapindex, baseUrl);
      }
      
      // Parse regular sitemap
      if (result.urlset) {
        return this.parseUrlSet(result.urlset, baseUrl);
      }
      
      throw new Error('Invalid sitemap format');
    } catch (error) {
      console.error('Error parsing sitemap:', error.message);
      throw error;
    }
  }

  async parseSitemapIndex(sitemapIndex, baseUrl) {
    const allUrls = [];
    const sitemaps = sitemapIndex.sitemap || [];
    
    console.log(`Found ${sitemaps.length} sitemaps in sitemap index`);
    
    // Process each sitemap (limit to prevent overwhelming)
    const maxSitemapsToProcess = 10;
    const sitemapsToProcess = sitemaps.slice(0, maxSitemapsToProcess);
    
    for (const sitemap of sitemapsToProcess) {
      try {
        const sitemapUrl = sitemap.loc[0];
        console.log(`Fetching sitemap: ${sitemapUrl}`);
        
        const response = await axios.get(sitemapUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AI Report Bot/1.0)'
          }
        });
        
        if (response.status === 200) {
          const sitemapUrls = await this.parseSitemap(response.data, baseUrl);
          allUrls.push(...sitemapUrls);
        }
      } catch (error) {
        console.error(`Error fetching sitemap ${sitemap.loc[0]}:`, error.message);
        continue;
      }
    }
    
    console.log(`Total URLs found from all sitemaps: ${allUrls.length}`);
    return allUrls;
  }

  parseUrlSet(urlset, baseUrl) {
    const urls = urlset.url || [];
    
    return urls.map(url => ({
      loc: url.loc[0],
      lastmod: url.lastmod ? url.lastmod[0] : null,
      changefreq: url.changefreq ? url.changefreq[0] : null,
      priority: url.priority ? parseFloat(url.priority[0]) : null
    }));
  }

  categorizeUrls(urls, baseUrl) {
    const baseUrlObj = new URL(baseUrl);
    const urlsByPattern = new Map();
    const processedUrls = [];
    
    // First pass: extract URL patterns and structure
    for (const url of urls) {
      try {
        const urlObj = new URL(url.loc);
        
        // Skip external URLs
        if (urlObj.hostname !== baseUrlObj.hostname) {
          continue;
        }
        
        const pathname = urlObj.pathname.toLowerCase();
        const segments = pathname.split('/').filter(s => s);
        const level = segments.length;
        
        // Identify homepage
        let category = 'other';
        if (pathname === '/' || pathname === '' || 
            pathname.match(/^\/(home|index|homepage)$/)) {
          category = 'homepage';
        }
        
        const processedUrl = {
          ...url,
          level,
          pathname,
          segments,
          category
        };
        
        processedUrls.push(processedUrl);
        
        // Group URLs by their first segment for pattern analysis
        if (segments.length > 0 && category !== 'homepage') {
          const firstSegment = segments[0];
          if (!urlsByPattern.has(firstSegment)) {
            urlsByPattern.set(firstSegment, []);
          }
          urlsByPattern.get(firstSegment).push(processedUrl);
        }
      } catch (error) {
        console.error(`Error processing URL ${url.loc}:`, error.message);
        continue;
      }
    }
    
    // Second pass: auto-detect categories based on URL patterns and frequency
    const categories = {
      homepage: [],
      other: []
    };
    
    // Add detected categories dynamically
    for (const [pattern, patternUrls] of urlsByPattern.entries()) {
      if (patternUrls.length >= 2) { // Only create category if there are at least 2 URLs
        categories[pattern] = patternUrls;
      } else {
        // Add single URLs to 'other' category
        categories.other.push(...patternUrls);
      }
    }
    
    // Add homepage URLs
    const homepageUrls = processedUrls.filter(url => url.category === 'homepage');
    categories.homepage = homepageUrls;
    
    // Add remaining URLs to 'other'
    const categorizedUrls = new Set();
    for (const categoryUrls of Object.values(categories)) {
      for (const url of categoryUrls) {
        categorizedUrls.add(url.loc);
      }
    }
    
    const uncategorizedUrls = processedUrls.filter(url => 
      !categorizedUrls.has(url.loc) && url.category !== 'homepage'
    );
    categories.other.push(...uncategorizedUrls);
    
    console.log(`Auto-detected URL patterns: ${Array.from(urlsByPattern.keys()).join(', ')}`);
    
    return categories;
  }

  createSampleSitemap(categories, maxPerCategory = 2) {
    const firstLevelLimit = parseInt(process.env.CRAWL_FIRST_LEVEL_LIMIT) || 10;
    const sampleUrls = [];
    
    // Always include homepage if available
    if (categories.homepage.length > 0) {
      sampleUrls.push(...categories.homepage.slice(0, 1));
    }
    
    // Include first-level pages (limit to 10 for crawling)
    const firstLevelPages = [];
    for (const category of Object.values(categories)) {
      const firstLevel = category.filter(url => url.level === 1);
      firstLevelPages.push(...firstLevel);
    }
    
    // Sort by priority if available, then by URL
    firstLevelPages.sort((a, b) => {
      if (a.priority && b.priority) {
        return b.priority - a.priority;
      }
      return a.loc.localeCompare(b.loc);
    });
    
    // Limit first-level pages for actual crawling
    const limitedFirstLevelPages = firstLevelPages.slice(0, firstLevelLimit);
    sampleUrls.push(...limitedFirstLevelPages);
    
    // Add sample pages from each category
    for (const [categoryName, categoryUrls] of Object.entries(categories)) {
      if (categoryName === 'homepage') continue; // Already added
      
      // Filter out first-level pages (already added above)
      const nonFirstLevel = categoryUrls.filter(url => url.level > 1);
      
      // Sort by priority and take sample
      nonFirstLevel.sort((a, b) => {
        if (a.priority && b.priority) {
          return b.priority - a.priority;
        }
        return a.loc.localeCompare(b.loc);
      });
      
      const sampleFromCategory = nonFirstLevel.slice(0, maxPerCategory);
      sampleUrls.push(...sampleFromCategory);
    }
    
    // Remove duplicates
    const uniqueUrls = sampleUrls.filter((url, index, self) => 
      index === self.findIndex(u => u.loc === url.loc)
    );
    
    console.log(`Created sample sitemap with ${uniqueUrls.length} URLs (limited first-level pages to ${firstLevelLimit})`);
    
    return {
      urls: uniqueUrls, // Limited URLs for actual crawling
      categories: Object.fromEntries(
        Object.entries(categories).map(([key, value]) => [key, value.length])
      ),
      firstLevelPages: {
        total: firstLevelPages.length,
        crawled: limitedFirstLevelPages.length,
        allPages: firstLevelPages.map(url => ({
          url: url.loc,
          title: url.title,
          level: url.level,
          pathname: url.pathname,
          priority: url.priority,
          changefreq: url.changefreq,
          lastmod: url.lastmod
        }))
      },
      totalOriginalUrls: Object.values(categories).reduce((sum, cat) => sum + cat.length, 0),
      crawlingLimits: {
        firstLevelLimit: firstLevelLimit,
        maxPerCategory: maxPerCategory
      }
    };
  }
}

module.exports = new SitemapParserService();