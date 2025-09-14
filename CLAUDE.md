# AI Report Development Plan

Repository: https://github.com/alisalti1992/ai-report

## Development Phases

### Phase 1: Simple Node Express Setup ✅
- Initialize Node.js project with Express ✅
- Basic server configuration and routing ✅
- Environment variables setup ✅

### Phase 2: Simple Swagger API Docs Setup ✅
- Install and configure Swagger/OpenAPI ✅
- Document basic API endpoints ✅
- Setup API documentation interface ✅

### Phase 3: Simple Prisma Studio Setup ✅
- Initialize Prisma ORM ✅
- Database schema design ✅
- Setup Prisma Studio for database management ✅

### Phase 4: Simple Crawljob URL API ✅
- Create crawljob endpoint with API token authentication ✅
- Basic crawljob data model ✅
- Token validation middleware ✅

### Phase 5: Verify Crawljob Endpoint ✅
- Create verify crawljob endpoint ✅
- Handle verification token validation ✅
- Update crawljob verification status ✅

### Phase 6: Browserless Crawler Setup ✅
- Step 1: Setup Browserless integration ✅
- Step 2: Find pending jobs that are verified to start ✅
- Step 3: Setup schema database for pages (include HTML content) ✅
- Step 4: Check provided URL status (200/301/404) and get actual homepage ✅
  - Handle redirects from provided URL (e.g., https://moveaheadmedia.co.th/seo/ → https://www.moveaheadmedia.co.th/seo/) ✅
  - Extract homepage from final URL (e.g., https://www.moveaheadmedia.co.th/) ✅
  - Handle international homepages (e.g., https://au.louisvuitton.com/eng-au/homepage) ✅
- Step 5: Find and store robots.txt for crawljob ✅
  - Check {homepage}/robots.txt ✅
  - Parse and store robots.txt content ✅
- Step 6: Find and store sitemap.xml for crawljob ✅
  - Check robots.txt for sitemap reference ✅
  - Check {homepage}/sitemap.xml as fallback ✅
  - Parse and store sitemap.xml content ✅
- Step 7: Create sample sitemap from sitemap.xml (first level + 2 pages per type) ✅
  - Extract all first level pages ✅
  - Determine page types by URL patterns/sitemap levels (blogs, services, products, categories) ✅
  - Select 2 pages of each type for sampling ✅
- Step 8: Handle multiple sitemaps in sitemap.xml when generating sample ✅
  - Parse sitemap index files ✅
  - Process multiple sitemap references ✅
  - Aggregate pages from all sitemaps for sampling ✅
- Step 9: If no sitemap.xml found, crawl homepage with Browserless to create sample sitemap ✅
  - Extract links from homepage ✅
  - Create basic sitemap structure from discovered links ✅
- Step 10: Add sample sitemap to crawljob database ✅
  - Store generated sample sitemap ✅
  - Link to crawljob record ✅
- Step 11: Crawl all pages in sample sitemap and store in database ✅
  - Use Browserless to crawl each page in sample sitemap ✅
  - Extract and store HTML content ✅
  - Store page metadata (title, status, etc.) ✅

### Phase 7: Send Pages to AI Webhook
- Send individual crawled pages to AI webhook
- Real-time page processing during crawl
- Error handling and retry logic

### Phase 8: Crawl Completion AI Webhook
- Send complete crawl data to AI webhook when sampling finishes
- Generate full crawl report
- Handle webhook responses

### Phase 9: Simple Frontend Form Widget
- Create embeddable widget with 2 fields (website URL and email)
- Generate widget embed code
- Cross-origin compatibility

### Phase 10: 2FA Email Verification
- Email verification system before processing crawljobs
- SMTP integration for verification emails
- Secure token generation and validation

### Phase 11: Report View Pages
- Create report overview page
- Page-by-page detailed view
- Navigation between report sections

### Phase 12: Docker Deployment
- Create Dockerfile for application
- Docker Compose configuration
- Easy server deployment setup

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run database migrations
npm run db:migrate

# Start Prisma Studio
npm run db:studio

# Run linting
npm run lint

# Build for production
npm run build
```