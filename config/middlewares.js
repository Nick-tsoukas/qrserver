// config/middlewares.js
module.exports = [
  // Security middleware
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
            'http://your-frontend-domain.com',
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
          'style-src': ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: null,
        },
      },
    },
  },

  // Logger middleware
  {
    name: 'strapi::logger',
    config: {
      level: 'debug',
      exposeInContext: true,
      requests: true,
    },
  },

  // Custom global middleware — now only runs on /api routes

  // Error handling middleware
  'strapi::errors',

  // CORS middleware
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:3000',
        'http://172.20.10.4:3000',
        'https://musicbizqr.com',
        'https://www.musicbizqr.com',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },

  // Powered-By header
  'strapi::poweredBy',

  // Query parser
  'strapi::query',

  // Body parser with Stripe webhook raw-body support
  {
    name: 'strapi::body',
    config: {
      patchKoa: true,         // expose raw body buffer
      includeUnparsed: true,  // keep unparsedBody for signature check
      multipart: true,
      formLimit: '50mb',
      jsonLimit: '50mb',
      textLimit: '50mb',
    },
  },

  // Session middleware
  'strapi::session',

  // Favicon middleware
  'strapi::favicon',

  // Public files
  'strapi::public',
];
