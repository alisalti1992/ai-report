const prisma = require('../lib/prisma');

const showVerifyPage = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { message, error } = req.query;

    // Get job information
    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        url: true,
        email: true,
        status: true,
        verified: true,
        cancelled: true,
        verifyAttempts: true,
        createdAt: true
      }
    });

    if (!job) {
      return res.status(404).send(renderErrorPage('Job Not Found', 'The verification job you\'re looking for doesn\'t exist.'));
    }

    if (job.cancelled) {
      return res.status(400).send(renderErrorPage('Job Cancelled', 'This verification job has been cancelled due to too many failed attempts.'));
    }

    if (job.verified) {
      return res.redirect(`/report/${jobId}`);
    }

    const remainingAttempts = Math.max(0, 5 - job.verifyAttempts);

    res.send(renderVerifyPage(job, message, error, remainingAttempts));
  } catch (error) {
    console.error('Error showing verify page:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An error occurred while loading the verification page.'));
  }
};

const processVerification = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { verifyToken } = req.body;

    if (!verifyToken || verifyToken.length !== 6) {
      return res.redirect(`/verify/${jobId}?error=Please enter a valid 6-digit verification code.`);
    }

    // Get job information
    const job = await prisma.crawlJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).send(renderErrorPage('Job Not Found', 'The verification job you\'re looking for doesn\'t exist.'));
    }

    if (job.cancelled) {
      return res.status(400).send(renderErrorPage('Job Cancelled', 'This verification job has been cancelled.'));
    }

    if (job.verified) {
      return res.redirect(`/report/${jobId}`);
    }

    // Check verification code
    if (job.verifyToken === verifyToken) {
      // Successful verification
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { 
          verified: true,
          status: 'verified'
        }
      });

      return res.redirect(`/report/${jobId}?message=Verification successful! Your report is being generated.`);
    } else {
      // Failed verification
      const newAttempts = job.verifyAttempts + 1;
      const remainingAttempts = Math.max(0, 5 - newAttempts);

      if (newAttempts >= 5) {
        // Cancel job after 5 failed attempts
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: { 
            cancelled: true,
            verifyAttempts: newAttempts,
            status: 'cancelled'
          }
        });

        return res.status(400).send(renderErrorPage('Verification Failed', 'Too many failed verification attempts. This job has been cancelled.'));
      } else {
        // Increment attempts
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: { verifyAttempts: newAttempts }
        });

        return res.redirect(`/verify/${jobId}?error=Invalid verification code. ${remainingAttempts} attempts remaining.`);
      }
    }
  } catch (error) {
    console.error('Error processing verification:', error);
    res.status(500).send(renderErrorPage('Server Error', 'An error occurred while processing verification.'));
  }
};

function renderVerifyPage(job, message, error, remainingAttempts) {
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
        <title>Verify Job - ${appName}</title>
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
            
            .container {
                max-width: 500px;
                margin: 50px auto;
                padding: 0 20px;
            }
            
            .card {
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                padding: 40px;
            }
            
            .logo {
                text-align: center;
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
            
            .title {
                text-align: center;
                margin-bottom: 10px;
                color: #1e293b;
                font-size: 24px;
                font-weight: 600;
            }
            
            .subtitle {
                text-align: center;
                margin-bottom: 30px;
                color: #64748b;
                font-size: 16px;
            }
            
            .job-info {
                background: #f1f5f9;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .job-info-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .job-info-item:last-child {
                border-bottom: none;
            }
            
            .job-info-label {
                font-weight: 500;
                color: #475569;
            }
            
            .job-info-value {
                color: #1e293b;
                font-weight: 600;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #374151;
            }
            
            .form-input {
                width: 100%;
                padding: 12px 16px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 16px;
                text-align: center;
                letter-spacing: 2px;
                font-weight: 600;
                transition: border-color 0.15s ease-in-out;
            }
            
            .form-input:focus {
                outline: none;
                border-color: ${primaryColor};
            }
            
            .btn {
                width: 100%;
                padding: 14px 20px;
                background-color: ${primaryColor};
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.15s ease-in-out;
            }
            
            .btn:hover {
                background-color: ${primaryColor}dd;
            }
            
            .alert {
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-weight: 500;
            }
            
            .alert-success {
                background-color: ${accentColor}20;
                color: ${accentColor};
                border: 1px solid ${accentColor}40;
            }
            
            .alert-error {
                background-color: #fef2f2;
                color: #dc2626;
                border: 1px solid #fca5a5;
            }
            
            .attempts-info {
                text-align: center;
                margin-top: 15px;
                color: #64748b;
                font-size: 14px;
            }
            
            .attempts-remaining {
                color: ${remainingAttempts <= 2 ? '#dc2626' : '#64748b'};
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="logo">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${appName}">` : `<h1>${appName}</h1>`}
                </div>
                
                <h2 class="title">Verify Your Request</h2>
                <p class="subtitle">Please enter the 6-digit verification code sent to your email</p>
                
                ${message ? `<div class="alert alert-success">${message}</div>` : ''}
                ${error ? `<div class="alert alert-error">${error}</div>` : ''}
                
                <div class="job-info">
                    <div class="job-info-item">
                        <span class="job-info-label">Website:</span>
                        <span class="job-info-value">${job.url}</span>
                    </div>
                    <div class="job-info-item">
                        <span class="job-info-label">Email:</span>
                        <span class="job-info-value">${job.email}</span>
                    </div>
                    <div class="job-info-item">
                        <span class="job-info-label">Requested:</span>
                        <span class="job-info-value">${new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                </div>
                
                <form method="POST">
                    <div class="form-group">
                        <label for="verifyToken" class="form-label">Verification Code</label>
                        <input 
                            type="text" 
                            id="verifyToken" 
                            name="verifyToken" 
                            class="form-input"
                            placeholder="000000"
                            maxlength="6"
                            required
                            autofocus
                        >
                    </div>
                    
                    <button type="submit" class="btn">Verify & Generate Report</button>
                </form>
                
                <div class="attempts-info">
                    Attempts remaining: <span class="attempts-remaining">${remainingAttempts}</span>
                </div>
            </div>
        </div>
        
        <script>
            // Auto-format verification code input
            document.getElementById('verifyToken').addEventListener('input', function(e) {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length > 6) value = value.substr(0, 6);
                e.target.value = value;
            });
            
            // Auto-submit when 6 digits are entered
            document.getElementById('verifyToken').addEventListener('input', function(e) {
                if (e.target.value.length === 6) {
                    // Small delay to show the complete code
                    setTimeout(() => {
                        e.target.form.submit();
                    }, 500);
                }
            });
        </script>
    </body>
    </html>
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
  showVerifyPage,
  processVerification
};