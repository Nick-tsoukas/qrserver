// path: config/env/production/middlewares.js
module.exports = [
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
      config: { /* your CORS config */ },
    },
  
    // 5) Logger, Query, Session, Favicon, Public
    'strapi::poweredBy',
    'strapi::logger',
    'strapi::query',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
  