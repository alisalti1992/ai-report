const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };
    
    this.branding = {
      appName: process.env.APP_NAME || 'AI Report',
      logoUrl: process.env.APP_LOGO_URL || '',
      primaryColor: process.env.APP_PRIMARY_COLOR || '#007bff',
      accentColor: process.env.APP_ACCENT_COLOR || '#28a745',
      serviceUrl: process.env.BASE_APP_URL || 'http://localhost:5555',
      fromEmail: process.env.SMTP_FROM || `"AI Report" <noreply@localhost>`
    };
    
    this.initializeTransporter();
  }
  
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport(this.config);
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }
  
  // Test email connection
  async testConnection() {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }
    
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      throw error;
    }
  }
  
  // Send 2FA verification email
  async sendVerificationEmail(email, verifyToken, jobId, websiteUrl) {
    const subject = `Verify your ${this.branding.appName} analysis request`;
    const html = this.generateVerificationEmailHTML(verifyToken, jobId, websiteUrl);
    const text = this.generateVerificationEmailText(verifyToken, jobId, websiteUrl);
    
    return this.sendEmail(email, subject, html, text);
  }
  
  // Send report completion email
  async sendCompletionEmail(email, jobId, websiteUrl, reportData) {
    const subject = `Your ${this.branding.appName} analysis is complete!`;
    const html = this.generateCompletionEmailHTML(jobId, websiteUrl, reportData);
    const text = this.generateCompletionEmailText(jobId, websiteUrl, reportData);
    
    return this.sendEmail(email, subject, html, text);
  }
  
  // Generic send email method
  async sendEmail(to, subject, html, text) {
    if (!this.transporter) {
      throw new Error('Email service not properly configured');
    }
    
    try {
      const mailOptions = {
        from: this.branding.fromEmail,
        to: to,
        subject: subject,
        text: text,
        html: html
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }
  
  // Generate verification email HTML template
  generateVerificationEmailHTML(verifyToken, jobId, websiteUrl) {
    const verifyUrl = `${this.branding.serviceUrl}/verify/${jobId}`;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your ${this.branding.appName} Request</title>
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
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: ${this.branding.primaryColor};
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .logo {
            margin-bottom: 20px;
        }
        
        .logo img {
            max-height: 60px;
            max-width: 200px;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .verification-code {
            background: #f1f5f9;
            border: 2px dashed ${this.branding.primaryColor};
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
        }
        
        .code {
            font-size: 36px;
            font-weight: 700;
            color: ${this.branding.primaryColor};
            letter-spacing: 4px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            margin-bottom: 15px;
        }
        
        .code-label {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 20px;
        }
        
        .verify-button {
            display: inline-block;
            background: ${this.branding.primaryColor};
            color: white !important;
            padding: 14px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.15s ease-in-out;
        }
        
        .verify-button:hover {
            background: ${this.branding.primaryColor}dd;
            color: white !important;
        }
        
        .instructions {
            background: #f8fafc;
            border-left: 4px solid ${this.branding.accentColor};
            padding: 20px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .instructions h3 {
            color: ${this.branding.accentColor};
            margin-bottom: 10px;
            font-size: 18px;
        }
        
        .instructions ol {
            margin-left: 20px;
            color: #475569;
        }
        
        .instructions li {
            margin-bottom: 8px;
        }
        
        .footer {
            background: #f1f5f9;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer p {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .footer a {
            color: ${this.branding.primaryColor};
            text-decoration: none;
        }
        
        .security-note {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
        }
        
        .security-note strong {
            color: #92400e;
        }
        
        .security-note p {
            color: #92400e;
            font-size: 14px;
        }
        
        @media (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            
            .header, .content, .footer {
                padding: 20px;
            }
            
            .code {
                font-size: 28px;
                letter-spacing: 2px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">
                ${this.branding.logoUrl ? 
                    `<img src="${this.branding.logoUrl}" alt="${this.branding.appName}">` : 
                    `<h1>${this.branding.appName}</h1>`
                }
            </div>
            <h1>Verify Your Request</h1>
            <p>Complete your website analysis verification</p>
        </div>
        
        <div class="content">
            <p>Hi there! 👋</p>
            
            <p>We received a request to analyze a website using ${this.branding.appName}. To proceed with the analysis, please verify your request using the verification code below:</p>
            
            <div class="verification-code">
                <div class="code">${verifyToken}</div>
                <div class="code-label">Your verification code</div>
                <a href="${verifyUrl}" class="verify-button">Verify Now</a>
            </div>
            
            <div class="instructions">
                <h3>📋 How to verify:</h3>
                <ol>
                    <li>Click the "Verify Now" button above, or visit: <br><strong>${verifyUrl}</strong></li>
                    <li>Enter the verification code: <strong>${verifyToken}</strong></li>
                    <li>Your website analysis will begin automatically</li>
                    <li>You'll receive another email when your report is ready</li>
                </ol>
            </div>
            
            <p>This verification code will expire in <strong>24 hours</strong> and can only be used once. If you didn't request this analysis, you can safely ignore this email.</p>
            
            <div class="security-note">
                <strong>🔒 Security Note:</strong>
                <p>Never share your verification code with anyone. Our team will never ask for your verification code via phone or email.</p>
            </div>
        </div>
        
        <div class="footer">
            <p>Need help? Contact us or visit our documentation.</p>
            <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                This email was sent to verify your website analysis request. 
                If you didn't request this analysis, please ignore this email.
            </p>
        </div>
    </div>
</body>
</html>`;
  }
  
  // Generate verification email text template
  generateVerificationEmailText(verifyToken, jobId, websiteUrl) {
    const verifyUrl = `${this.branding.serviceUrl}/verify/${jobId}`;
    
    return `
${this.branding.appName} - Verify Your Request

Hi there!

We received a request to analyze a website using ${this.branding.appName}. 

Your verification code: ${verifyToken}

To complete verification:
1. Visit: ${verifyUrl}
2. Enter your verification code: ${verifyToken}
3. Your analysis will begin automatically
4. You'll receive another email when your report is ready

This code expires in 24 hours and can only be used once.

If you didn't request this analysis, please ignore this email.

---
Security Note: Never share your verification code with anyone.
`;
  }
  
  // Generate completion email HTML template
  generateCompletionEmailHTML(jobId, websiteUrl, reportData) {
    const reportUrl = `${this.branding.serviceUrl}/report/${jobId}`;
    const pdfUrl = `${this.branding.serviceUrl}/report/${jobId}/pdf`;
    
    const totalPages = reportData?.totalPages || reportData?.pages?.length || 0;
    const completedPages = reportData?.completedPages || reportData?.pages?.filter(p => p.aiResponse)?.length || totalPages;
    const completionRate = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 100;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your ${this.branding.appName} Report is Ready!</title>
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
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, ${this.branding.primaryColor} 0%, ${this.branding.accentColor} 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .logo {
            margin-bottom: 20px;
        }
        
        .logo img {
            max-height: 60px;
            max-width: 200px;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .success-badge {
            background: ${this.branding.accentColor}20;
            color: ${this.branding.accentColor};
            padding: 12px 24px;
            border-radius: 50px;
            display: inline-block;
            font-weight: 600;
            margin-bottom: 30px;
            border: 2px solid ${this.branding.accentColor}40;
        }
        
        .website-info {
            background: #f8fafc;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            border-left: 4px solid ${this.branding.primaryColor};
        }
        
        .website-url {
            font-size: 18px;
            font-weight: 600;
            color: ${this.branding.primaryColor};
            margin-bottom: 15px;
            word-break: break-all;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 20px 0;
        }
        
        .stat-item {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .stat-number {
            font-size: 28px;
            font-weight: 700;
            color: ${this.branding.primaryColor};
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 500;
        }
        
        .action-buttons {
            text-align: center;
            margin: 40px 0;
        }
        
        .btn {
            display: inline-block;
            padding: 16px 32px;
            margin: 0 10px 15px 10px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.15s ease-in-out;
        }
        
        .btn-primary {
            background: ${this.branding.primaryColor};
            color: white !important;
        }
        
        .btn-primary:hover {
            background: ${this.branding.primaryColor}dd;
            color: white !important;
            transform: translateY(-2px);
        }
        
        .btn-outline {
            background: white;
            color: ${this.branding.primaryColor} !important;
            border: 2px solid ${this.branding.primaryColor};
        }
        
        .btn-outline:hover {
            background: ${this.branding.primaryColor};
            color: white !important;
        }
        
        .highlights {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
        }
        
        .highlights h3 {
            color: #1e293b;
            margin-bottom: 20px;
            font-size: 20px;
        }
        
        .highlight-item {
            display: flex;
            align-items: flex-start;
            margin-bottom: 15px;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid ${this.branding.accentColor};
        }
        
        .highlight-icon {
            font-size: 20px;
            margin-right: 15px;
            margin-top: 2px;
        }
        
        .highlight-text {
            flex: 1;
        }
        
        .highlight-title {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 5px;
        }
        
        .highlight-desc {
            color: #64748b;
            font-size: 14px;
        }
        
        .footer {
            background: #f1f5f9;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer p {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .footer a {
            color: ${this.branding.primaryColor};
            text-decoration: none;
        }
        
        @media (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            
            .header, .content, .footer {
                padding: 20px;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
            
            .btn {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">
                ${this.branding.logoUrl ? 
                    `<img src="${this.branding.logoUrl}" alt="${this.branding.appName}">` : 
                    `<h1>${this.branding.appName}</h1>`
                }
            </div>
            <h1>🎉 Your Report is Ready!</h1>
            <p>Comprehensive AI-powered website analysis complete</p>
        </div>
        
        <div class="content">
            <div class="success-badge">✅ Analysis Complete</div>
            
            <p>Great news! We've completed the comprehensive AI analysis of your website. Your detailed report is now ready for review.</p>
            
            <div class="website-info">
                <div class="website-url">${websiteUrl}</div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number">${totalPages}</div>
                        <div class="stat-label">Pages Analyzed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${completedPages}</div>
                        <div class="stat-label">AI Processed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${completionRate}%</div>
                        <div class="stat-label">Complete</div>
                    </div>
                </div>
            </div>
            
            <div class="action-buttons">
                <a href="${reportUrl}" class="btn btn-primary">📊 View Report</a>
                <a href="${pdfUrl}" class="btn btn-outline">📄 Download PDF</a>
            </div>
            
            <div class="highlights">
                <h3>🔍 What's in your report:</h3>
                
                <div class="highlight-item">
                    <div class="highlight-icon">🤖</div>
                    <div class="highlight-text">
                        <div class="highlight-title">AI Readability Report</div>
                        <div class="highlight-desc">Detailed analysis and recommendations</div>
                    </div>
                </div>
                
                <div class="highlight-item">
                    <div class="highlight-icon">📈</div>
                    <div class="highlight-text">
                        <div class="highlight-title">Actionable Insights</div>
                        <div class="highlight-desc">Specific recommendations to improve your website's effectiveness</div>
                    </div>
                </div>
                
                <div class="highlight-item">
                    <div class="highlight-icon">📊</div>
                    <div class="highlight-text">
                        <div class="highlight-title">Performance Metrics</div>
                        <div class="highlight-desc">Detailed scores and analysis across multiple categories</div>
                    </div>
                </div>
                
                <div class="highlight-item">
                    <div class="highlight-icon">🔧</div>
                    <div class="highlight-text">
                        <div class="highlight-title">Technical Recommendations</div>
                        <div class="highlight-desc">Expert advice on technical improvements and optimizations</div>
                    </div>
                </div>
            </div>
            
            <p>Your report includes detailed analysis of structured data, accessibility, performance, content optimization, and more. Each section provides both current assessment and actionable recommendations.</p>
            
            <p><strong>Questions about your report?</strong> Visit our documentation or contact our support team for assistance.</p>
        </div>
        
        <div class="footer">
            <p>Thank you for using ${this.branding.appName}! 🚀</p>
            <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                This email was sent to notify you of your completed website analysis.
                Your report will be available for 30 days from the analysis date.
            </p>
        </div>
    </div>
</body>
</html>`;
  }
  
  // Generate completion email text template
  generateCompletionEmailText(jobId, websiteUrl, reportData) {
    const reportUrl = `${this.branding.serviceUrl}/report/${jobId}`;
    const pdfUrl = `${this.branding.serviceUrl}/report/${jobId}/pdf`;
    
    const totalPages = reportData?.totalPages || reportData?.pages?.length || 0;
    const completedPages = reportData?.completedPages || reportData?.pages?.filter(p => p.aiResponse)?.length || totalPages;
    const completionRate = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 100;
    
    return `
${this.branding.appName} - Your Report is Ready!

🎉 Analysis Complete

Great news! We've completed the comprehensive AI analysis of your website.

Website: ${websiteUrl}
Pages Analyzed: ${totalPages}
AI Processed: ${completedPages}
Completion Rate: ${completionRate}%

📊 View Your Report: ${reportUrl}
📄 Download PDF: ${pdfUrl}

What's in your report:
• AI Readability Report - Detailed analysis and recommendations
• Actionable Insights - Specific recommendations for improvement
• Performance Metrics - Detailed scores across multiple categories  
• Technical Recommendations - Expert advice on optimizations

Your report includes analysis of structured data, accessibility, performance, content optimization, and more.

Thank you for using ${this.branding.appName}!

---
Questions? Contact support or visit our documentation.
Your report will be available for 30 days.
`;
  }
}

module.exports = EmailService;