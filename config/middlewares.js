// config/middlewares.js
module.exports = [
    // 0) Our custom raw-logging middleware
    {
      name: 'global::log-raw',
      config: {},
    },
  
  // 1) Body parser with raw-body support: MUST be first
  {
    name: 'strapi::body',
    config: {
      patchKoa: true,
      includeUnparsed: true,
      parsedMethods: ['POST', 'PUT', 'PATCH'], // ensure POST bodies come through :contentReference[oaicite:1]{index=1}
      multipart: true,
      formLimit: '50mb',
      jsonLimit: '50mb',
      textLimit: '50mb',
    },
  },

  // 2) Error handling middleware
  'strapi::errors',

  // 3) Security middleware
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

  // 4) Logger middleware
  {
    name: 'strapi::logger',
    config: {
      level: 'debug',
      exposeInContext: true,
      requests: true,
    },
  },

  // 5) CORS middleware
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

  // 6) Powered-by header
  'strapi::poweredBy',

  // 7) Query parser
  'strapi::query',

  // 8) Session middleware
  'strapi::session',

  // 9) Favicon middleware
  'strapi::favicon',

  // 10) Public files
  'strapi::public',
];
