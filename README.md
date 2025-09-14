# AI Report

AI-powered web crawling and analysis platform that generates comprehensive reports from website data.

## Features

- **Web Crawling**: Automated website crawling with configurable sampling
- **AI Analysis**: Real-time page analysis and comprehensive reporting
- **API Integration**: RESTful API with token authentication
- **Email Verification**: 2FA email verification system
- **Embeddable Widget**: Frontend form widget for any website
- **Report Views**: Detailed report overview and page-by-page analysis
- **Easy Deployment**: Docker support for simple server deployment

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Service Configuration
SERVICE_URL_APP=http://localhost:3000
API_TOKEN=your-api-token

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_report

# Application Settings
APP_NAME=AI Report
APP_LOGO_URL=
APP_PRIMARY_COLOR=#007bff
APP_ACCENT_COLOR=#28a745

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
SMTP_FROM=noreply@your-domain.com

# Browserless Configuration
BROWSERLESS_URL=ws://localhost:3000
BROWSERLESS_TOKEN=your-browserless-token

# AI Hooks
AI_PAGE_ANALYZER_HOOK=https://your-ai-service.com/analyze-page
AI_CRAWL_ANALYZER_HOOK=https://your-ai-service.com/analyze-crawl
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

## API Documentation

Once the server is running, visit `/api-docs` for Swagger documentation.

## Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up -d
```

## License

MIT