# AI Report

AI-powered web crawling and analysis platform that generates comprehensive reports from website data.

## Project Status

✅ **Phase 1-8 Complete**: Core crawling infrastructure and AI integration fully implemented  
🚧 **Phase 9-12**: Frontend widget, report views, and deployment features in development

## Features

### ✅ Implemented (Phase 1-8)
- **Web Crawling**: Intelligent browserless crawling with automatic background processing
- **Smart Site Analysis**: Automatic homepage detection, robots.txt parsing, and sitemap discovery
- **Adaptive Sampling**: Dynamic URL pattern detection and intelligent sample sitemap generation
- **Configurable Crawling**: Environment variable control for first-level page limits
- **API Integration**: RESTful API with Bearer token authentication and Swagger documentation
- **Email Verification**: 6-digit code verification system with attempt limits
- **Database Storage**: Complete page content storage with metadata using Prisma ORM
- **Real-time AI Analysis**: Individual page processing via AI webhooks during crawl
- **Crawl Completion AI**: Complete crawl analysis with optimized data payload
- **AI Response Storage**: Full AI webhook response tracking and error handling
- **Comprehensive Error Tracking**: Detailed error logging and step-by-step failure analysis

### 🚧 Planned (Phase 9-12)
- **Embeddable Widget**: Frontend form widget for any website
- **Report Views**: Detailed report overview and page-by-page analysis
- **Easy Deployment**: Docker support for simple server deployment

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Service Configuration
PORT=5555
SERVICE_URL_APP=http://localhost:5555
API_TOKEN=your-secure-api-token

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_report

# Application Settings
APP_NAME=AI Report
APP_LOGO_URL=https://your-domain.com/logo.png
APP_PRIMARY_COLOR=#007bff
APP_ACCENT_COLOR=#28a745

# SMTP Configuration (for email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="AI Report <noreply@your-domain.com>"

# Browserless Configuration
BROWSERLESS_URL=https://your-browserless-instance.com/
BROWSERLESS_TOKEN=your-browserless-token

# AI Hooks (for future AI analysis phases)
AI_PAGE_ANALYZER_HOOK=https://your-ai-service.com/webhook/page-analyzer
AI_CRAWL_ANALYZER_HOOK=https://your-ai-service.com/webhook/crawl-analyzer

# Crawling Configuration
CRAWL_FIRST_LEVEL_LIMIT=10  # Maximum first-level pages to crawl per job
```

## Installation

```bash
# Clone the repository
git clone https://github.com/alisalti1992/ai-report.git
cd ai-report

# Install dependencies
npm install

# Setup database
npm run db:migrate

# Start development server
npm run dev
```

## Development Commands

```bash
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

## How It Works

### Current Crawling Process (Phase 1-8)

1. **Job Creation**: Submit a website URL via API with Bearer token authentication
2. **Email Verification**: Verify ownership with 6-digit email code (5 attempts max)
3. **Automatic Processing**: Background service automatically processes verified jobs:
   - Checks URL status and extracts homepage (handles redirects and international sites)
   - Discovers and parses robots.txt and sitemap.xml
   - Creates intelligent sample sitemap with auto-detected URL patterns
   - Crawls sample pages (configurable first-level page limit) and stores full HTML content
   - Sends each page to AI webhook for real-time analysis
   - Sends complete crawl summary to AI completion webhook
4. **Database Storage**: All data stored in PostgreSQL with Prisma ORM
5. **AI Integration**: Real-time page analysis and comprehensive crawl completion analysis

### API Endpoints

- `POST /api/crawljobs` - Create new crawl job
- `POST /api/crawljobs/verify` - Verify crawl job with email code
- `GET /api/health` - Health check endpoint

## API Documentation

Once the server is running, visit `/api-docs` for interactive Swagger documentation with authentication support.

## Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up -d
```

## License

MIT