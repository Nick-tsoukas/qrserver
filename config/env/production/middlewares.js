// path: config/env/production/middlewares.js
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
        multipart: true,
        formLimit: '50mb',
        jsonLimit: '50mb',
        textLimit: '50mb',
      },
    },
  
    // 2) Error handler
    'strapi::errors',
  
    // 3) Security
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: { /* your CSP config */ },
      },
    },
  
    // 4) CORS
    {
      name: 'strapi::cors',
      config: {
        origin: [
          'https://musicbizqr.com',
          'https://www.musicbizqr.com',
        ],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        keepHeaderOnError: true,
      },
    },
  
    // 5) Logger, Query, Session, Favicon, Public
    'strapi::poweredBy',
    'strapi::logger',
    'strapi::query',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];