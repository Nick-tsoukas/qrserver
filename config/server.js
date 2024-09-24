module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),  // Reference the APP_KEYS environment variable
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // Enable more detailed logging
  logger: {
    level: 'debug',  // Set the log level to 'debug' for detailed logs
    exposeInContext: true,  // Exposes the logger inside API routes, controllers, etc.
    requests: true,  // Logs each incoming HTTP request
  },
});