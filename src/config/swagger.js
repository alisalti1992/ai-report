const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Report API',
      version: '1.0.0',
      description: 'AI-powered web crawling and analysis platform API',
      contact: {
        name: 'AI Report Team',
        url: 'https://github.com/alisalti1992/ai-report'
      }
    },
    servers: [
      {
        url: process.env.SERVICE_URL_APP || 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key'
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/server.js']
};

const specs = swaggerJsdoc(options);
module.exports = specs;