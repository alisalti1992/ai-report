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
                    <h3>🤖 AI Readability Report</h3>
                    <p>AI readability report analysis</p>
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
                    <a href="/widget/embed" class="btn btn-outline">Get Embed Code</a>
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

// Widget configuration endpoint
router.get('/widget/config.js', (req, res) => {
  const config = {
    apiUrl: process.env.SERVICE_URL_APP || 'http://localhost:5555',
    apiToken: process.env.API_TOKEN || 'your-api-token',
    appName: process.env.APP_NAME || 'AI Report',
    logoUrl: process.env.APP_LOGO_URL || '',
    primaryColor: process.env.APP_PRIMARY_COLOR || '#007bff',
    accentColor: process.env.APP_ACCENT_COLOR || '#28a745'
  };

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

  res.send(`window.AIReportConfig = ${JSON.stringify(config, null, 2)};`);
});

// Widget embed code generator
router.get('/widget/embed', (req, res) => {
  const appName = process.env.APP_NAME || 'AI Report';
  const logoUrl = process.env.APP_LOGO_URL || '';
  const primaryColor = process.env.APP_PRIMARY_COLOR || '#007bff';
  const serviceUrl = process.env.SERVICE_URL_APP || 'http://localhost:5555';
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Widget Embed Code - ${appName}</title>
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
                padding: 40px 20px;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
            }
            
            .logo h1 {
                color: ${primaryColor};
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 10px;
            }
            
            .subtitle {
                color: #64748b;
                font-size: 18px;
            }
            
            .card {
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                padding: 30px;
                margin-bottom: 30px;
            }
            
            .card-title {
                font-size: 24px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 20px;
            }
            
            .code-block {
                background: #1e293b;
                color: #e2e8f0;
                padding: 20px;
                border-radius: 8px;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.5;
                overflow-x: auto;
                position: relative;
            }
            
            .copy-btn {
                position: absolute;
                top: 15px;
                right: 15px;
                background: ${primaryColor};
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.15s ease-in-out;
            }
            
            .copy-btn:hover {
                background: ${primaryColor}dd;
            }
            
            .copy-btn.copied {
                background: #10b981;
            }
            
            .step {
                margin-bottom: 20px;
            }
            
            .step-number {
                background: ${primaryColor};
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                margin-right: 15px;
            }
            
            .preview {
                border: 2px dashed #e5e7eb;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                color: #64748b;
                margin-bottom: 20px;
            }
            
            .back-btn {
                display: inline-block;
                padding: 12px 24px;
                background: white;
                color: ${primaryColor};
                text-decoration: none;
                border: 2px solid ${primaryColor};
                border-radius: 8px;
                font-weight: 600;
                transition: all 0.15s ease-in-out;
            }
            
            .back-btn:hover {
                background: ${primaryColor};
                color: white;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${appName}" style="max-height: 60px; max-width: 300px;">` : `<h1>${appName}</h1>`}
                </div>
                <div class="subtitle">Embed Widget - Easy Integration</div>
            </div>
            
            <div class="card">
                <h2 class="card-title">📦 Embed ${appName} Widget</h2>
                <p style="margin-bottom: 30px; color: #64748b;">Copy and paste the code below to embed the ${appName} widget on any website.</p>
                
                <div class="step">
                    <span class="step-number">1</span>
                    <strong>Add this HTML where you want the widget to appear:</strong>
                </div>
                
                <div class="code-block">
                    <button class="copy-btn" onclick="copyToClipboard('html-code')">Copy</button>
                    <pre id="html-code">&lt;div id="ai-report-widget"&gt;&lt;/div&gt;</pre>
                </div>
                
                <div class="step">
                    <span class="step-number">2</span>
                    <strong>Add this JavaScript before the closing &lt;/body&gt; tag:</strong>
                </div>
                
                <div class="code-block">
                    <button class="copy-btn" onclick="copyToClipboard('js-code')">Copy</button>
                    <pre id="js-code">&lt;script src="${serviceUrl}/public/widget.js"&gt;&lt;/script&gt;</pre>
                </div>
                
                <div class="step">
                    <span class="step-number">3</span>
                    <strong>Complete embed code (copy everything):</strong>
                </div>
                
                <div class="code-block">
                    <button class="copy-btn" onclick="copyToClipboard('complete-code')">Copy All</button>
                    <pre id="complete-code">&lt;!-- ${appName} Widget --&gt;
&lt;div id="ai-report-widget"&gt;&lt;/div&gt;
&lt;script src="${serviceUrl}/public/widget.js"&gt;&lt;/script&gt;</pre>
                </div>
            </div>
            
            <div class="card">
                <h3 class="card-title">🎨 Customization Options</h3>
                <p style="margin-bottom: 20px; color: #64748b;">You can customize the widget by setting configuration before loading the script:</p>
                
                <div class="code-block">
                    <button class="copy-btn" onclick="copyToClipboard('custom-code')">Copy</button>
                    <pre id="custom-code">&lt;!-- ${appName} Widget with Custom Config --&gt;
&lt;script&gt;
window.AIReportConfig = {
    // Optional: Override default styling
    primaryColor: '#your-color',
    accentColor: '#your-accent-color',
    // Optional: Custom API endpoint (usually not needed)
    apiUrl: '${serviceUrl}',
    apiToken: 'your-api-token'
};
&lt;/script&gt;
&lt;div id="ai-report-widget"&gt;&lt;/div&gt;
&lt;script src="${serviceUrl}/public/widget.js"&gt;&lt;/script&gt;</pre>
                </div>
            </div>
            
            <div class="card">
                <h3 class="card-title">✅ Features</h3>
                <ul style="margin-left: 20px; color: #64748b;">
                    <li>✨ <strong>Zero Configuration</strong> - Works out of the box with your branding</li>
                    <li>🎨 <strong>Branded Design</strong> - Automatically uses your app colors and logo</li>
                    <li>📱 <strong>Responsive</strong> - Looks great on all devices</li>
                    <li>🔒 <strong>Secure</strong> - Uses your API token for authentication</li>
                    <li>⚡ <strong>Fast Loading</strong> - Optimized for quick page load</li>
                    <li>🌐 <strong>Cross-Origin</strong> - Embeds on any domain</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="/" class="back-btn">← Back to Home</a>
            </div>
        </div>
        
        <script>
            function copyToClipboard(elementId) {
                const element = document.getElementById(elementId);
                const text = element.textContent;
                
                navigator.clipboard.writeText(text).then(() => {
                    const btn = element.parentNode.querySelector('.copy-btn');
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    const btn = element.parentNode.querySelector('.copy-btn');
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.classList.remove('copied');
                    }, 2000);
                });
            }
        </script>
    </body>
    </html>
  `);
});

// Report endpoints
router.get('/report/:jobId', reportController.showReport);
router.get('/report/:jobId/pdf', reportController.generateReportPDF);
router.get('/report/:jobId/:pageId', reportController.showPageReport);
router.get('/report/:jobId/:pageId.pdf', reportController.generatePageReportPDF);

module.exports = router;