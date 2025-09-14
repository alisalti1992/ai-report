const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Import page controllers
const verifyController = require('../controllers/verify');
const reportController = require('../controllers/report');

// Homepage
router.get('/', (req, res) => {
  const appName = process.env.APP_NAME || 'AI Report';
  const logoUrl = process.env.APP_LOGO_URL || '';
  const primaryColor = process.env.APP_PRIMARY_COLOR || '#007bff';
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${appName} - AI-Powered Website Analysis</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%);
                color: #334155;
                line-height: 1.6;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .container {
                max-width: 600px;
                padding: 0 20px;
                text-align: center;
            }
            
            .logo {
                margin-bottom: 40px;
            }
            
            .logo img {
                max-height: 80px;
                max-width: 300px;
            }
            
            .logo h1 {
                color: ${primaryColor};
                font-size: 48px;
                font-weight: 700;
                margin-bottom: 10px;
            }
            
            .tagline {
                color: #64748b;
                font-size: 18px;
                margin-bottom: 50px;
            }
            
            .features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 30px;
                margin-bottom: 50px;
            }
            
            .feature {
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            
            .feature h3 {
                color: ${primaryColor};
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .feature p {
                color: #64748b;
                font-size: 14px;
            }
            
            .cta {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            
            .cta h2 {
                color: #1e293b;
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            
            .cta p {
                color: #64748b;
                margin-bottom: 30px;
            }
            
            .links {
                display: flex;
                gap: 20px;
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .btn {
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                transition: all 0.15s ease-in-out;
            }
            
            .btn-primary {
                background: ${primaryColor};
                color: white;
            }
            
            .btn-primary:hover {
                background: ${primaryColor}dd;
                transform: translateY(-2px);
            }
            
            .btn-outline {
                background: white;
                color: ${primaryColor};
                border: 2px solid ${primaryColor};
            }
            
            .btn-outline:hover {
                background: ${primaryColor};
                color: white;
            }
            
            @media (max-width: 768px) {
                .logo h1 {
                    font-size: 36px;
                }
                
                .features {
                    grid-template-columns: 1fr;
                }
                
                .links {
                    flex-direction: column;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                ${logoUrl ? `<img src="${logoUrl}" alt="${appName}">` : `<h1>${appName}</h1>`}
            </div>
            
            <p class="tagline">AI-powered website analysis and performance insights</p>
            
            <div class="features">
                <div class="feature">
                    <h3>🤖 AI Analysis</h3>
                    <p>Advanced AI analyzes your website's performance, SEO, accessibility, and user experience</p>
                </div>
                <div class="feature">
                    <h3>📊 Comprehensive Reports</h3>
                    <p>Detailed reports with actionable insights and recommendations for improvement</p>
                </div>
                <div class="feature">
                    <h3>⚡ Fast & Reliable</h3>
                    <p>Quick analysis with intelligent crawling and real-time processing</p>
                </div>
            </div>
            
            <div class="cta">
                <h2>Get Started</h2>
                <p>Explore our API documentation or use our embeddable widget to analyze your website</p>
                
                <div class="links">
                    <a href="/api-docs" class="btn btn-primary">API Documentation</a>
                    <a href="/public/widget.html" class="btn btn-outline">Try Widget Demo</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Verify job endpoint
router.get('/verify/:jobId', verifyController.showVerifyPage);
router.post('/verify/:jobId', verifyController.processVerification);

// Report endpoints
router.get('/report/:jobId', reportController.showReport);
router.get('/report/:jobId/pdf', reportController.generateReportPDF);
router.get('/report/:jobId/:pageId', reportController.showPageReport);
router.get('/report/:jobId/:pageId.pdf', reportController.generatePageReportPDF);

module.exports = router;