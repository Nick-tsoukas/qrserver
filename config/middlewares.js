module.exports = [
  // Enable security middleware with updated Content Security Policy
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': [
            "'self'",
            'https:',
            'http:',
            'wss:',
            'ws:',
            'http://localhost:1337',
            'https://apis.google.com',
            'https://accounts.google.com',
            'https://graph.facebook.com',
            'https://www.facebook.com',
            'http://your-frontend-domain.com', // Replace with your actual frontend domain
          ],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'dl.airtable.com',
            'qrcode101.s3.us-east-1.amazonaws.com',
            'https://platform-lookaside.fbsbx.com',
            'https://lh3.googleusercontent.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'dl.airtable.com',
            'qrcode101.s3.us-east-1.amazonaws.com',
          ],
          'frame-src': [
            "'self'",
            'https://accounts.google.com',
            'https://www.facebook.com',
          ],
          'script-src': [
            "'self'",
            "'unsafe-inline'",
            'https://connect.facebook.net',
            'https://apis.google.com',
          ],
          'style-src': [
            "'self'",
            "'unsafe-inline'",
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },

  // Logger middleware
  {
    name: 'strapi::logger',
    config: {
      level: 'debug', // or 'trace' for even more detailed logs
      exposeInContext: true,
      requests: true,
    },
  },

  // Error handling middleware
  'strapi::errors',

  // CORS middleware with configuration
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: [
        'http://localhost:3000',          // Frontend development URL
        'https://musicbizqr.com', // Replace with your actual frontend domain
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'], // Explicitly allowed headers

      keepHeaderOnError: true,
    },
  },

  // Other middlewares
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
