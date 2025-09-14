(function() {
    'use strict';
    
    // Default configuration
    const defaultConfig = {
        apiUrl: 'http://localhost:5555',
        apiToken: 'your-api-token',
        theme: 'light',
        primaryColor: '#3b82f6',
        accentColor: '#10b981'
    };
    
    // Merge user config with defaults
    const config = Object.assign({}, defaultConfig, window.AIReportConfig || {});
    
    // Create widget CSS
    const widgetCSS = `
        .ai-report-widget {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 24px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            box-sizing: border-box;
        }
        
        .ai-report-widget * {
            box-sizing: border-box;
        }
        
        .ai-report-widget h3 {
            margin: 0 0 16px 0;
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            text-align: center;
        }
        
        .ai-report-widget p {
            margin: 0 0 20px 0;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
            line-height: 1.5;
        }
        
        .ai-report-form-group {
            margin-bottom: 16px;
        }
        
        .ai-report-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 6px;
        }
        
        .ai-report-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        
        .ai-report-input:focus {
            outline: none;
            border-color: ${config.primaryColor};
            box-shadow: 0 0 0 3px ${config.primaryColor}20;
        }
        
        .ai-report-input.error {
            border-color: #ef4444;
        }
        
        .ai-report-error {
            color: #ef4444;
            font-size: 12px;
            margin-top: 4px;
            display: none;
        }
        
        .ai-report-button {
            width: 100%;
            padding: 12px 16px;
            background-color: ${config.primaryColor};
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.15s ease-in-out;
        }
        
        .ai-report-button:hover:not(:disabled) {
            background-color: ${config.primaryColor}dd;
        }
        
        .ai-report-button:disabled {
            background-color: #9ca3af;
            cursor: not-allowed;
        }
        
        .ai-report-success {
            background-color: ${config.accentColor};
            color: white;
            padding: 12px;
            border-radius: 6px;
            text-align: center;
            font-size: 14px;
            margin-top: 16px;
            display: none;
        }
        
        .ai-report-loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: ai-report-spin 1s ease-in-out infinite;
            margin-right: 8px;
        }
        
        @keyframes ai-report-spin {
            to { transform: rotate(360deg); }
        }
        
        .ai-report-powered-by {
            text-align: center;
            margin-top: 16px;
            font-size: 12px;
            color: #9ca3af;
        }
        
        .ai-report-powered-by a {
            color: ${config.primaryColor};
            text-decoration: none;
        }
        
        .ai-report-powered-by a:hover {
            text-decoration: underline;
        }
    `;
    
    // Create widget HTML
    const widgetHTML = `
        <div class="ai-report-widget">
            <h3>Get Your AI Website Report</h3>
            <p>Analyze your website's performance, SEO, and user experience with AI-powered insights.</p>
            
            <form class="ai-report-form">
                <div class="ai-report-form-group">
                    <label for="ai-report-url" class="ai-report-label">Website URL</label>
                    <input 
                        type="url" 
                        id="ai-report-url" 
                        name="url"
                        class="ai-report-input" 
                        placeholder="https://example.com"
                        required
                    >
                    <div class="ai-report-error ai-report-url-error"></div>
                </div>
                
                <div class="ai-report-form-group">
                    <label for="ai-report-email" class="ai-report-label">Email Address</label>
                    <input 
                        type="email" 
                        id="ai-report-email" 
                        name="email"
                        class="ai-report-input" 
                        placeholder="your@email.com"
                        required
                    >
                    <div class="ai-report-error ai-report-email-error"></div>
                </div>
                
                <button type="submit" class="ai-report-button">
                    <span class="ai-report-button-text">Generate Report</span>
                </button>
            </form>
            
            <div class="ai-report-success">
                ✅ Report request submitted! Check your email for verification.
            </div>
            
            <div class="ai-report-powered-by">
                Powered by <a href="https://github.com/alisalti1992/ai-report" target="_blank">AI Report</a>
            </div>
        </div>
    `;
    
    // Widget functionality
    class AIReportWidget {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error(`AI Report Widget: Container with ID "${containerId}" not found.`);
                return;
            }
            
            this.init();
        }
        
        init() {
            // Inject CSS
            this.injectCSS();
            
            // Inject HTML
            this.container.innerHTML = widgetHTML;
            
            // Bind events
            this.bindEvents();
        }
        
        injectCSS() {
            // Check if CSS is already injected
            if (!document.getElementById('ai-report-widget-styles')) {
                const style = document.createElement('style');
                style.id = 'ai-report-widget-styles';
                style.textContent = widgetCSS;
                document.head.appendChild(style);
            }
        }
        
        bindEvents() {
            const form = this.container.querySelector('.ai-report-form');
            const submitBtn = this.container.querySelector('.ai-report-button');
            const buttonText = this.container.querySelector('.ai-report-button-text');
            const successMessage = this.container.querySelector('.ai-report-success');
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSubmit(form, submitBtn, buttonText, successMessage);
            });
        }
        
        async handleSubmit(form, submitBtn, buttonText, successMessage) {
            // Reset previous errors
            this.clearErrors();
            
            // Get form data
            const formData = new FormData(form);
            const url = formData.get('url');
            const email = formData.get('email');
            
            // Basic validation
            if (!this.isValidUrl(url)) {
                this.showError('.ai-report-url-error', 'Please enter a valid URL (including http:// or https://)');
                return;
            }
            
            if (!this.isValidEmail(email)) {
                this.showError('.ai-report-email-error', 'Please enter a valid email address');
                return;
            }
            
            // Show loading state
            submitBtn.disabled = true;
            buttonText.innerHTML = '<span class="ai-report-loading"></span>Submitting...';
            
            try {
                const response = await fetch(`${config.apiUrl}/api/crawljobs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiToken}`
                    },
                    body: JSON.stringify({ url, email })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Success
                    form.style.display = 'none';
                    successMessage.style.display = 'block';
                    
                    // Optional: Trigger custom event for parent page
                    this.triggerCustomEvent('ai-report-success', { jobId: result.jobId, url, email });
                } else {
                    // Handle API errors
                    if (result.error) {
                        this.showError('.ai-report-url-error', result.error);
                    } else {
                        this.showError('.ai-report-url-error', 'Something went wrong. Please try again.');
                    }
                    
                    this.triggerCustomEvent('ai-report-error', { error: result.error || 'Unknown error' });
                }
            } catch (error) {
                console.error('AI Report Widget error:', error);
                this.showError('.ai-report-url-error', 'Connection error. Please check your internet connection and try again.');
                this.triggerCustomEvent('ai-report-error', { error: error.message });
            } finally {
                // Reset button state
                submitBtn.disabled = false;
                buttonText.innerHTML = 'Generate Report';
            }
        }
        
        isValidUrl(string) {
            try {
                const url = new URL(string);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch (_) {
                return false;
            }
        }
        
        isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }
        
        showError(selector, message) {
            const errorElement = this.container.querySelector(selector);
            const inputElement = this.container.querySelector(selector.replace('-error', '').replace('ai-report-', '#ai-report-'));
            
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            }
            
            if (inputElement) {
                inputElement.classList.add('error');
            }
        }
        
        clearErrors() {
            const errorElements = this.container.querySelectorAll('.ai-report-error');
            const inputElements = this.container.querySelectorAll('.ai-report-input');
            
            errorElements.forEach(el => {
                el.style.display = 'none';
                el.textContent = '';
            });
            
            inputElements.forEach(el => {
                el.classList.remove('error');
            });
        }
        
        triggerCustomEvent(eventName, detail) {
            const event = new CustomEvent(eventName, { detail });
            this.container.dispatchEvent(event);
        }
    }
    
    // Auto-initialize if container exists
    window.AIReportWidget = AIReportWidget;
    
    // Auto-init for common container IDs
    document.addEventListener('DOMContentLoaded', function() {
        const commonIds = ['ai-report-widget', 'ai-report', 'website-report-widget'];
        
        commonIds.forEach(id => {
            if (document.getElementById(id)) {
                new AIReportWidget(id);
            }
        });
    });
    
})();