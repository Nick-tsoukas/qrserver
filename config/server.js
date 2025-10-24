// config/server.js
const cronTasks = require('./cron-tasks');

module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  cron: {
    enabled: true,
    tasks: cronTasks,            // ← explicitly attach tasks
  },
  logger: {
    exposeInContext: true,
    requests: true,
    level: env('STRAPI_LOG_LEVEL', 'info'),
    timestamps: true,
  },
});
