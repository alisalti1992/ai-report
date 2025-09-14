const prisma = require('../lib/prisma');
const puppeteer = require('puppeteer');

const showReport = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { message } = req.query;

    // Get job with all related data
    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId },
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
            aiResponse: true,
            aiError: true,
            aiProcessed: true,
            crawledAt: true,
            error: true
          },
          orderBy: { level: 'asc' }
        }
      }
    });

    if (!job) {
      return res.status(404).send(renderErrorPage('Report Not Found', 'The report you\'re looking for doesn\'t exist.'));
    }

    if (!job.verified) {
      return res.redirect(`/verify/${jobId}`);
    }

    res.send(renderReportPage(job, message));
  } catch (error) {
    console.error('Error showing report:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An error occurred while loading the report.'));
  }
};

const generateReportPDF = async (req, res) => {
  let browser;
  try {
    const { jobId } = req.params;

    // Get job data
    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: { pages: true }
    });

    if (!job || !job.verified) {
      return res.redirect(`/report/${jobId}`);
    }

    if (job.status !== 'completed') {
      return res.redirect(`/report/${jobId}?message=Report is still being generated. Please check back in a few minutes.`);
    }

    // Generate PDF using Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    
    // Generate PDF-optimized HTML content
    const htmlContent = renderReportPageForPDF(job);
    console.log('HTML content length:', htmlContent.length);
    
    // Set content with proper waiting
    await page.setContent(htmlContent, { 
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000 
    });
    
    console.log('Page content loaded successfully');

    // Wait a bit more for any async content
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate PDF with better options
    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '0.8in',
        right: '0.6in',
        bottom: '0.8in',
        left: '0.6in'
      },
      displayHeaderFooter: false
    });

    console.log('PDF generated, buffer length:', pdfBuffer.length);

    // Close browser before sending response
    await browser.close();
    browser = null;

    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }
    
    // Debug: Check what's actually in the buffer
    const pdfHeader = pdfBuffer.slice(0, 10).toString();
    console.log('PDF header (first 10 bytes):', JSON.stringify(pdfHeader));
    console.log('PDF header hex:', pdfBuffer.slice(0, 10).toString('hex'));

    // Set headers for PDF download
    const filename = `website-analysis-report-${job.url.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Send PDF
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Error generating report PDF:', error);
    console.error('PDF Error details:', {
      message: error.message,
      stack: error.stack,
      jobId: req.params.jobId
    });
    
    // Send error response instead of redirect for better debugging
    res.status(500).json({
      error: 'PDF generation failed',
      message: error.message,
      jobId: req.params.jobId
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
};

const showPageReport = async (req, res) => {
  try {
    const { jobId, pageId } = req.params;
    const { message } = req.query;

    // Get job and specific page data
    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        url: true,
        email: true,
        status: true,
        verified: true,
        homepage: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!job || !job.verified) {
      return res.redirect(`/verify/${jobId}`);
    }

    const page = await prisma.crawlPage.findUnique({
      where: { 
        id: pageId,
        crawlJobId: jobId
      }
    });

    if (!page) {
      return res.status(404).send(renderErrorPage('Page Not Found', 'The page report you\'re looking for doesn\'t exist.'));
    }

    res.send(renderPageReportPage(job, page, message));
  } catch (error) {
    console.error('Error showing page report:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An error occurred while loading the page report.'));
  }
};

const generatePageReportPDF = async (req, res) => {
  try {
    const { jobId, pageId } = req.params;

    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, verified: true }
    });

    const page = await prisma.crawlPage.findUnique({
      where: { 
        id: pageId,
        crawlJobId: jobId
      },
      select: { id: true, aiProcessed: true }
    });

    if (!job || !job.verified || !page) {
      return res.redirect(`/report/${jobId}/${pageId}`);
    }

    if (!page.aiProcessed || job.status !== 'completed') {
      return res.redirect(`/report/${jobId}/${pageId}?message=Page analysis is still being processed. Please check back in a few minutes.`);
    }

    // For now, redirect to HTML version
    // TODO: Implement actual PDF generation
    res.redirect(`/report/${jobId}/${pageId}?message=PDF generation will be available soon. Viewing HTML version.`);
  } catch (error) {
    console.error('Error generating page report PDF:', error);
    res.redirect(`/report/${req.params.jobId}/${req.params.pageId}?message=Error generating PDF. Please try again.`);
  }
};

function getStatusColor(status) {
  const colors = {
    'pending': '#f59e0b',
    'verified': '#3b82f6',
    'processing': '#8b5cf6',
    'completed': '#10b981',
    'failed': '#ef4444',
    'cancelled': '#6b7280'
  };
  return colors[status] || '#64748b';
}

function getStatusText(status) {
  const texts = {
    'pending': 'Pending Verification',
    'verified': 'Verified - Queued',
    'processing': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    'cancelled': 'Cancelled'
  };
  return texts[status] || status;
}

function formatAIScore(score) {
  const scoreMap = {
    'Poor': { color: '#ef4444', percentage: '20%' },
    'Fair': { color: '#f59e0b', percentage: '40%' },
    'Good': { color: '#8b5cf6', percentage: '60%' },
    'Very Good': { color: '#06b6d4', percentage: '80%' },
    'Excellent': { color: '#10b981', percentage: '100%' }
  };
  return scoreMap[score] || { color: '#64748b', percentage: '0%' };
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderReportPage(job, message) {
  const appName = process.env.APP_NAME || 'AI Report';
  const logoUrl = process.env.APP_LOGO_URL || '';
  const primaryColor = process.env.APP_PRIMARY_COLOR || '#007bff';
  const accentColor = process.env.APP_ACCENT_COLOR || '#28a745';
  
  const statusColor = getStatusColor(job.status);
  const statusText = getStatusText(job.status);
  
  const successfulPages = job.pages.filter(p => p.statusCode >= 200 && p.statusCode < 300).length;
  const aiProcessedPages = job.pages.filter(p => p.aiProcessed && p.aiResponse).length;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Website Report - ${appName}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background-color: #f8fafc;
                color: #334155;
                line-height: 1.6;
            }
            
            .header {
                background: white;
                border-bottom: 1px solid #e5e7eb;
                padding: 20px 0;
            }
            
            .header-content {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .logo {
                display: flex;
                align-items: center;
            }
            
            .logo img {
                max-height: 40px;
                max-width: 150px;
            }
            
            .logo h1 {
                color: ${primaryColor};
                font-size: 24px;
                font-weight: 700;
            }
            
            .status-badge {
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 600;
                font-size: 14px;
                background: ${statusColor}20;
                color: ${statusColor};
                border: 1px solid ${statusColor}40;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 30px 20px;
            }
            
            .card {
                background: white;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                margin-bottom: 30px;
                padding: 30px;
            }
            
            .card-title {
                font-size: 20px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 20px;
            }
            
            .alert {
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-weight: 500;
                background-color: ${accentColor}20;
                color: ${accentColor};
                border: 1px solid ${accentColor}40;
            }
            
            .overview-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .stat-item {
                text-align: center;
                padding: 20px;
                background: #f8fafc;
                border-radius: 8px;
            }
            
            .stat-number {
                font-size: 32px;
                font-weight: 700;
                color: ${primaryColor};
                margin-bottom: 5px;
            }
            
            .stat-label {
                color: #64748b;
                font-size: 14px;
            }
            
            .pages-list {
                display: grid;
                gap: 15px;
            }
            
            .page-item {
                padding: 20px;
                background: #f8fafc;
                border-radius: 8px;
                border-left: 4px solid ${primaryColor};
            }
            
            .page-header {
                display: flex;
                justify-content: between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .page-title {
                font-weight: 600;
                color: #1e293b;
                flex: 1;
            }
            
            .page-status {
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 12px;
                font-weight: 500;
            }
            
            .page-url {
                color: #64748b;
                font-size: 14px;
                word-break: break-all;
                margin-bottom: 10px;
            }
            
            
            .btn {
                padding: 8px 16px;
                border-radius: 6px;
                text-decoration: none;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.15s ease-in-out;
                border: none;
                cursor: pointer;
            }
            
            .btn-primary {
                background: ${primaryColor};
                color: white;
            }
            
            .btn-primary:hover {
                background: ${primaryColor}dd;
            }
            
            .btn-outline {
                background: white;
                color: ${primaryColor};
                border: 1px solid ${primaryColor};
            }
            
            .btn-outline:hover {
                background: ${primaryColor}10;
            }
            
            .ai-summary {
                display: grid;
                gap: 15px;
                margin-top: 15px;
            }
            
            .ai-category {
                padding: 15px;
                background: white;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }
            
            .ai-category-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .ai-category-title {
                font-weight: 600;
                color: #1e293b;
            }
            
            .ai-score {
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            }
            
            @media (max-width: 768px) {
                .header-content {
                    flex-direction: column;
                    gap: 15px;
                }
                
                .overview-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-content">
                <div class="logo">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${appName}">` : `<h1>${appName}</h1>`}
                </div>
                <div class="status-badge">${statusText}</div>
            </div>
        </div>
        
        <div class="container">
            ${message ? `<div class="alert">${message}</div>` : ''}
            
            <div class="card">
                <h2 class="card-title">Website Analysis Report</h2>
                
                <div class="overview-grid">
                    <div class="stat-item">
                        <div class="stat-number">${job.pages.length}</div>
                        <div class="stat-label">Total Pages Analyzed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${successfulPages}</div>
                        <div class="stat-label">Successfully Crawled</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${aiProcessedPages}</div>
                        <div class="stat-label">AI Analyzed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${Math.round((aiProcessedPages / job.pages.length) * 100) || 0}%</div>
                        <div class="stat-label">Analysis Complete</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <strong>Website:</strong> <span style="color: ${primaryColor};">${job.url}</span>
                    <strong>Requested:</strong> ${new Date(job.createdAt).toLocaleDateString()}
                    ${job.status === 'completed' ? `<strong>Completed:</strong> ${new Date(job.updatedAt).toLocaleDateString()}` : ''}
                </div>
                
                ${job.status === 'completed' ? `
                    <div style="margin-top: 20px;">
                        <a href="/report/${job.id}/pdf" class="btn btn-primary">Download PDF Report</a>
                    </div>
                ` : ''}
            </div>
            
            ${job.crawlCompletionAI ? `
                <div class="card">
                    <h2 class="card-title">Overall Website Analysis</h2>
                    ${renderCrawlCompletionAnalysis(job.crawlCompletionAI)}
                </div>
            ` : ''}
            
            ${job.pages.length > 0 ? `
                <div class="card">
                    <h2 class="card-title">Crawled Pages Summary</h2>
                    <div class="pages-table">
                        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 2px solid #e5e7eb;">
                                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e5e7eb;">Page Title</th>
                                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e5e7eb;">URL</th>
                                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #1e293b; border-bottom: 2px solid #e5e7eb;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${job.pages.map(page => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px; color: #1e293b; font-weight: 500;">${page.title || 'Untitled Page'}</td>
                                        <td style="padding: 12px; color: #64748b; word-break: break-all; font-size: 14px;">${page.url}</td>
                                        <td style="padding: 12px; text-align: center;">
                                            <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${page.statusCode >= 200 && page.statusCode < 300 ? '#10b98120' : '#ef444420'}; color: ${page.statusCode >= 200 && page.statusCode < 300 ? '#10b981' : '#ef4444'};">
                                                ${page.statusCode || 'Failed'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        </div>
    </body>
    </html>
  `;
}

function renderAISummary(aiResponse) {
  if (!aiResponse || typeof aiResponse !== 'object') return '';
  
  const categories = Object.keys(aiResponse);
  if (categories.length === 0) return '';
  
  return `
    <div class="ai-summary">
      ${categories.slice(0, 3).map(categoryKey => {
        const category = aiResponse[categoryKey];
        if (!category || !category.score) return '';
        
        const scoreInfo = formatAIScore(category.score);
        return `
          <div class="ai-category">
            <div class="ai-category-header">
              <div class="ai-category-title">${categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
              <div class="ai-score" style="background: ${scoreInfo.color}20; color: ${scoreInfo.color};">
                ${category.score}
              </div>
            </div>
            ${category.observations && category.observations.length > 0 ? 
              `<div style="color: #64748b; font-size: 14px;">${escapeHtml(category.observations[0]).substring(0, 150)}${category.observations[0].length > 150 ? '...' : ''}</div>` : 
              ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderReportPageForPDF(job) {
  const appName = process.env.APP_NAME || 'AI Report';
  const logoUrl = process.env.APP_LOGO_URL || '';
  const primaryColor = process.env.APP_PRIMARY_COLOR || '#007bff';
  const accentColor = process.env.APP_ACCENT_COLOR || '#28a745';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Website Analysis Report - ${escapeHtml(job.url)} - ${appName}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background-color: #ffffff;
                color: #334155;
                line-height: 1.5;
                font-size: 14px;
            }
            
            .header {
                background: ${primaryColor};
                color: white;
                padding: 20px 0;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .header h1 {
                font-size: 24px;
                margin-bottom: 8px;
            }
            
            .header .subtitle {
                font-size: 14px;
                opacity: 0.9;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 0 20px;
            }
            
            .card {
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                margin-bottom: 20px;
                padding: 20px;
                break-inside: avoid;
            }
            
            .card-title {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 15px;
                border-bottom: 2px solid ${primaryColor};
                padding-bottom: 8px;
            }
            
            .overview-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .stat-item {
                text-align: center;
                padding: 12px;
                background: #f8fafc;
                border-radius: 4px;
            }
            
            .stat-number {
                font-size: 20px;
                font-weight: 700;
                color: ${primaryColor};
                margin-bottom: 4px;
            }
            
            .stat-label {
                color: #64748b;
                font-size: 11px;
                line-height: 1.3;
            }
            
            .analysis-category {
                margin-bottom: 15px;
                padding: 15px;
                background: #f8fafc;
                border-radius: 4px;
                border-left: 4px solid #64748b;
                break-inside: avoid;
            }
            
            .category-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .category-header h3 {
                margin: 0;
                color: #1e293b;
                font-size: 14px;
                font-weight: 600;
            }
            
            .score-badge {
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                background: #e5e7eb;
                color: #64748b;
            }
            
            .score-excellent { background: #10b98120; color: #10b981; }
            .score-excellent .analysis-category { border-left-color: #10b981; }
            .score-good { background: #8b5cf620; color: #8b5cf6; }
            .score-good .analysis-category { border-left-color: #8b5cf6; }
            .score-fair { background: #f59e0b20; color: #f59e0b; }
            .score-fair .analysis-category { border-left-color: #f59e0b; }
            .score-poor { background: #ef444420; color: #ef4444; }
            .score-poor .analysis-category { border-left-color: #ef4444; }
            
            .section-title {
                color: #374151;
                font-size: 12px;
                margin-bottom: 6px;
                font-weight: 600;
            }
            
            .section-content ul {
                margin: 0;
                padding-left: 18px;
                color: #64748b;
                font-size: 11px;
                line-height: 1.4;
            }
            
            .section-content li {
                margin-bottom: 4px;
            }
            
            .pages-table table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
            }
            
            .pages-table th,
            .pages-table td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #e5e7eb;
                font-size: 10px;
            }
            
            .pages-table th {
                background: #f8fafc;
                font-weight: 600;
                color: #1e293b;
            }
            
            .status-ok { color: #10b981; font-weight: 600; }
            .status-error { color: #ef4444; font-weight: 600; }
            
            .meta-info {
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                margin-bottom: 15px;
                padding: 12px;
                background: #f1f5f9;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .meta-info strong {
                color: #1e293b;
            }
            
            @media print {
                body { font-size: 11px; }
                .header { margin-bottom: 15px; padding: 15px 0; }
                .card { margin-bottom: 15px; padding: 15px; }
                .analysis-category { margin-bottom: 12px; padding: 12px; }
                .overview-grid { margin-bottom: 15px; }
                .meta-info { margin-bottom: 12px; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="container">
                <h1>${appName} - Website Analysis Report</h1>
                <div class="subtitle">Comprehensive AI-powered analysis</div>
            </div>
        </div>
        
        <div class="container">
            <div class="card">
                <h2 class="card-title">Report Summary</h2>
                
                <div class="overview-grid">
                    <div class="stat-item">
                        <div class="stat-number">${job.pages ? job.pages.length : 0}</div>
                        <div class="stat-label">Total Pages Analyzed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${job.pages ? job.pages.filter(p => p.statusCode >= 200 && p.statusCode < 300).length : 0}</div>
                        <div class="stat-label">Successfully Crawled</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${job.pages ? job.pages.filter(p => p.aiResponse).length : 0}</div>
                        <div class="stat-label">AI Analyzed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${job.pages && job.pages.length > 0 ? Math.round((job.pages.filter(p => p.aiResponse).length / job.pages.length) * 100) : 0}%</div>
                        <div class="stat-label">Analysis Complete</div>
                    </div>
                </div>
                
                <div class="meta-info">
                    <div><strong>Website:</strong> ${escapeHtml(job.url)}</div>
                    <div><strong>Requested:</strong> ${new Date(job.createdAt).toLocaleDateString()}</div>
                    ${job.status === 'completed' ? `<div><strong>Completed:</strong> ${new Date(job.updatedAt).toLocaleDateString()}</div>` : ''}
                </div>
            </div>
            
            ${job.crawlCompletionAI ? `
                <div class="card">
                    <h2 class="card-title">Overall Website Analysis</h2>
                    ${renderCrawlCompletionAnalysisForPDF(job.crawlCompletionAI)}
                </div>
            ` : ''}
            
            ${job.pages && job.pages.length > 0 ? `
                <div class="card">
                    <h2 class="card-title">Crawled Pages Summary</h2>
                    <div class="pages-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Page Title</th>
                                    <th>URL</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${job.pages.map(page => `
                                    <tr>
                                        <td style="font-weight: 500;">${escapeHtml(page.title || 'Untitled Page')}</td>
                                        <td style="word-break: break-all;">${escapeHtml(page.url)}</td>
                                        <td class="${page.statusCode >= 200 && page.statusCode < 300 ? 'status-ok' : 'status-error'}">
                                            ${page.statusCode || 'Failed'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        </div>
    </body>
    </html>
  `;
}

function renderCrawlCompletionAnalysisForPDF(crawlCompletionAI) {
  if (!crawlCompletionAI || !crawlCompletionAI.response) return '<p style="color: #64748b;">No overall analysis available.</p>';
  
  const aiData = crawlCompletionAI.response;
  const categories = Object.keys(aiData);
  if (categories.length === 0) return '<p style="color: #64748b;">No analysis categories found.</p>';
  
  return `
    <div class="crawl-completion-analysis-pdf">
      ${categories.map(categoryKey => {
        const category = aiData[categoryKey];
        if (!category || typeof category !== 'object') return '';
        
        const scoreInfo = formatAIScore(category.score);
        const scoreClass = category.score ? `score-${category.score.toLowerCase().replace(' ', '-')}` : '';
        
        return `
          <div class="analysis-category ${scoreClass}" style="border-left-color: ${scoreInfo.color};">
            <div class="category-header">
              <h3>${categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
              ${category.score ? `
                <div class="score-badge" style="background: ${scoreInfo.color}20; color: ${scoreInfo.color};">
                  ${category.score}
                </div>
              ` : ''}
            </div>
            
            ${category.observations && Array.isArray(category.observations) && category.observations.length > 0 ? `
              <div class="section-content" style="margin-bottom: 15px;">
                <div class="section-title">Key Issues & Observations:</div>
                <ul>
                  ${category.observations.map(obs => `<li>${escapeHtml(obs)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${category.tests_passed && Array.isArray(category.tests_passed) && category.tests_passed.length > 0 ? `
              <div class="section-content" style="margin-bottom: 15px;">
                <div class="section-title" style="color: #059669;">✓ Tests Passed:</div>
                <ul style="color: #047857;">
                  ${category.tests_passed.map(test => `<li>${escapeHtml(test)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${category.recommendations && Array.isArray(category.recommendations) && category.recommendations.length > 0 ? `
              <div class="section-content">
                <div class="section-title" style="color: #7c3aed;">💡 Recommendations:</div>
                <ul style="color: #6b46c1;">
                  ${category.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCrawlCompletionAnalysis(crawlCompletionAI) {
  if (!crawlCompletionAI || !crawlCompletionAI.response) return '<p style="color: #64748b;">No overall analysis available.</p>';
  
  const aiData = crawlCompletionAI.response;
  const categories = Object.keys(aiData);
  if (categories.length === 0) return '<p style="color: #64748b;">No analysis categories found.</p>';
  
  return `
    <div class="crawl-completion-analysis">
      ${categories.map(categoryKey => {
        const category = aiData[categoryKey];
        if (!category || typeof category !== 'object') return '';
        
        const scoreInfo = formatAIScore(category.score);
        return `
          <div class="analysis-category" style="margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid ${scoreInfo.color};">
            <div class="category-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">${categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
              ${category.score ? `
                <div style="background: ${scoreInfo.color}20; color: ${scoreInfo.color}; padding: 6px 16px; border-radius: 16px; font-size: 14px; font-weight: 600;">
                  ${category.score}
                </div>
              ` : ''}
            </div>
            
            ${category.observations && Array.isArray(category.observations) && category.observations.length > 0 ? `
              <div style="margin-bottom: 20px;">
                <h4 style="color: #374151; font-size: 16px; margin-bottom: 10px; font-weight: 600;">Key Issues & Observations:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 14px; line-height: 1.6;">
                  ${category.observations.map(obs => `<li style="margin-bottom: 8px;">${escapeHtml(obs)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${category.tests_passed && Array.isArray(category.tests_passed) && category.tests_passed.length > 0 ? `
              <div style="margin-bottom: 20px;">
                <h4 style="color: #059669; font-size: 16px; margin-bottom: 10px; font-weight: 600;">✓ Tests Passed:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.6;">
                  ${category.tests_passed.map(test => `<li style="margin-bottom: 8px;">${escapeHtml(test)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${category.recommendations && Array.isArray(category.recommendations) && category.recommendations.length > 0 ? `
              <div>
                <h4 style="color: #7c3aed; font-size: 16px; margin-bottom: 10px; font-weight: 600;">💡 Recommendations:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #6b46c1; font-size: 14px; line-height: 1.6;">
                  ${category.recommendations.map(rec => `<li style="margin-bottom: 8px;">${escapeHtml(rec)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPageReportPage(job, page, message) {
  const appName = process.env.APP_NAME || 'AI Report';
  const logoUrl = process.env.APP_LOGO_URL || '';
  const primaryColor = process.env.APP_PRIMARY_COLOR || '#007bff';
  const accentColor = process.env.APP_ACCENT_COLOR || '#28a745';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Page Report - ${page.title || 'Untitled'} - ${appName}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background-color: #f8fafc;
                color: #334155;
                line-height: 1.6;
            }
            
            .header {
                background: white;
                border-bottom: 1px solid #e5e7eb;
                padding: 20px 0;
            }
            
            .header-content {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .logo {
                display: flex;
                align-items: center;
            }
            
            .logo img {
                max-height: 40px;
                max-width: 150px;
            }
            
            .logo h1 {
                color: ${primaryColor};
                font-size: 24px;
                font-weight: 700;
            }
            
            .breadcrumb {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: #64748b;
            }
            
            .breadcrumb a {
                color: ${primaryColor};
                text-decoration: none;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 30px 20px;
            }
            
            .card {
                background: white;
                border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                margin-bottom: 30px;
                padding: 30px;
            }
            
            .card-title {
                font-size: 20px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 20px;
            }
            
            .alert {
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-weight: 500;
                background-color: ${accentColor}20;
                color: ${accentColor};
                border: 1px solid ${accentColor}40;
            }
            
            .page-header {
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            
            .page-title {
                font-size: 24px;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 10px;
            }
            
            .page-url {
                color: ${primaryColor};
                font-size: 16px;
                word-break: break-all;
                margin-bottom: 15px;
            }
            
            .page-meta {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
            }
            
            .meta-item {
                display: flex;
                justify-content: space-between;
            }
            
            .meta-label {
                font-weight: 500;
                color: #64748b;
            }
            
            .meta-value {
                font-weight: 600;
                color: #1e293b;
            }
            
            .status-success {
                color: ${accentColor};
            }
            
            .status-error {
                color: #ef4444;
            }
            
            .ai-analysis {
                display: grid;
                gap: 25px;
            }
            
            .ai-category {
                background: #f8fafc;
                border-radius: 8px;
                padding: 25px;
                border-left: 4px solid ${primaryColor};
            }
            
            .ai-category-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .ai-category-title {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
            }
            
            .ai-score {
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
            }
            
            .ai-section {
                margin-bottom: 20px;
            }
            
            .ai-section-title {
                font-weight: 600;
                color: #374151;
                margin-bottom: 10px;
            }
            
            .ai-list {
                list-style: none;
                padding: 0;
            }
            
            .ai-list li {
                padding: 8px 0;
                border-bottom: 1px solid #e5e7eb;
                color: #64748b;
            }
            
            .ai-list li:last-child {
                border-bottom: none;
            }
            
            .ai-list.tests-passed li {
                position: relative;
                padding-left: 20px;
            }
            
            .ai-list.tests-passed li:before {
                content: "✓";
                position: absolute;
                left: 0;
                color: ${accentColor};
                font-weight: bold;
            }
            
            .ai-list.recommendations li {
                position: relative;
                padding-left: 20px;
            }
            
            .ai-list.recommendations li:before {
                content: "💡";
                position: absolute;
                left: 0;
            }
            
            .btn {
                display: inline-block;
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                transition: all 0.15s ease-in-out;
                border: none;
                cursor: pointer;
            }
            
            .btn-primary {
                background: ${primaryColor};
                color: white;
            }
            
            .btn-primary:hover {
                background: ${primaryColor}dd;
            }
            
            .btn-outline {
                background: white;
                color: ${primaryColor};
                border: 1px solid ${primaryColor};
            }
            
            .btn-outline:hover {
                background: ${primaryColor}10;
            }
            
            .actions {
                display: flex;
                gap: 15px;
                margin-top: 30px;
                flex-wrap: wrap;
            }
            
            @media (max-width: 768px) {
                .header-content {
                    flex-direction: column;
                    gap: 15px;
                }
                
                .page-meta {
                    grid-template-columns: 1fr;
                }
                
                .actions {
                    flex-direction: column;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-content">
                <div class="logo">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${appName}">` : `<h1>${appName}</h1>`}
                </div>
                <div class="breadcrumb">
                    <a href="/report/${job.id}">← Back to Report</a>
                </div>
            </div>
        </div>
        
        <div class="container">
            ${message ? `<div class="alert">${message}</div>` : ''}
            
            <div class="card">
                <div class="page-header">
                    <h1 class="page-title">${page.title || 'Untitled Page'}</h1>
                    <div class="page-url">${page.url}</div>
                    
                    <div class="page-meta">
                        <div class="meta-item">
                            <span class="meta-label">Status Code:</span>
                            <span class="meta-value ${page.statusCode >= 200 && page.statusCode < 300 ? 'status-success' : 'status-error'}">
                                ${page.statusCode || 'Failed'}
                            </span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Page Level:</span>
                            <span class="meta-value">${page.level || 0}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Redirected:</span>
                            <span class="meta-value">${page.redirected ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">AI Processed:</span>
                            <span class="meta-value ${page.aiProcessed ? 'status-success' : 'status-error'}">
                                ${page.aiProcessed ? 'Yes' : 'No'}
                            </span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Crawled:</span>
                            <span class="meta-value">${new Date(page.crawledAt).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                
                ${page.error ? `
                    <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <strong>Crawl Error:</strong> ${page.error}
                    </div>
                ` : ''}
                
                ${page.aiError && page.aiProcessed ? `
                    <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <strong>AI Analysis Error:</strong> ${page.aiError}
                    </div>
                ` : ''}
                
                ${page.aiResponse ? renderDetailedAIAnalysis(page.aiResponse) : 
                  page.aiProcessed ? `<p style="color: #ef4444; text-align: center; padding: 40px;">AI Analysis failed for this page.</p>` : 
                  `<p style="color: #64748b; text-align: center; padding: 40px;">AI analysis is still being processed...</p>`}
                
                <div class="actions">
                    <a href="/report/${job.id}" class="btn btn-outline">← Back to Report</a>
                    ${page.aiResponse ? `<a href="/report/${job.id}/${page.id}.pdf" class="btn btn-primary">Download PDF</a>` : ''}
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

function renderDetailedAIAnalysis(aiResponse) {
  if (!aiResponse || typeof aiResponse !== 'object') return '';
  
  const categories = Object.keys(aiResponse);
  if (categories.length === 0) return '';
  
  return `
    <div class="ai-analysis">
      <h2 class="card-title">AI Analysis Results</h2>
      ${categories.map(categoryKey => {
        const category = aiResponse[categoryKey];
        if (!category || typeof category !== 'object') return '';
        
        const scoreInfo = formatAIScore(category.score);
        return `
          <div class="ai-category">
            <div class="ai-category-header">
              <h3 class="ai-category-title">${categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
              ${category.score ? `
                <div class="ai-score" style="background: ${scoreInfo.color}20; color: ${scoreInfo.color};">
                  ${category.score}
                </div>
              ` : ''}
            </div>
            
            ${category.observations && Array.isArray(category.observations) && category.observations.length > 0 ? `
              <div class="ai-section">
                <h4 class="ai-section-title">Key Observations</h4>
                <ul class="ai-list">
                  ${category.observations.map(obs => `<li>${escapeHtml(obs)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${category.tests_passed && Array.isArray(category.tests_passed) && category.tests_passed.length > 0 ? `
              <div class="ai-section">
                <h4 class="ai-section-title">Tests Passed</h4>
                <ul class="ai-list tests-passed">
                  ${category.tests_passed.map(test => `<li>${test}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${category.recommendations && Array.isArray(category.recommendations) && category.recommendations.length > 0 ? `
              <div class="ai-section">
                <h4 class="ai-section-title">Recommendations</h4>
                <ul class="ai-list recommendations">
                  ${category.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderErrorPage(title, message) {
  const appName = process.env.APP_NAME || 'AI Report';
  const logoUrl = process.env.APP_LOGO_URL || '';
  const primaryColor = process.env.APP_PRIMARY_COLOR || '#007bff';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - ${appName}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background-color: #f8fafc;
                color: #334155;
                line-height: 1.6;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
            }
            
            .container {
                max-width: 500px;
                padding: 0 20px;
            }
            
            .card {
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                padding: 40px;
                text-align: center;
            }
            
            .logo {
                margin-bottom: 30px;
            }
            
            .logo img {
                max-height: 60px;
                max-width: 200px;
            }
            
            .logo h1 {
                color: ${primaryColor};
                font-size: 28px;
                font-weight: 700;
                margin-top: 10px;
            }
            
            .error-title {
                color: #dc2626;
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .error-message {
                color: #64748b;
                font-size: 16px;
                margin-bottom: 30px;
            }
            
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background-color: ${primaryColor};
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                transition: background-color 0.15s ease-in-out;
            }
            
            .btn:hover {
                background-color: ${primaryColor}dd;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="logo">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${appName}">` : `<h1>${appName}</h1>`}
                </div>
                
                <h2 class="error-title">${title}</h2>
                <p class="error-message">${message}</p>
                
                <a href="/" class="btn">Go Home</a>
            </div>
        </div>
    </body>
    </html>
  `;
}

module.exports = {
  showReport,
  generateReportPDF,
  showPageReport,
  generatePageReportPDF
};