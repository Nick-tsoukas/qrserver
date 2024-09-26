const path = require('path');

module.exports = ({ env }) => {
  const isDev = env('NODE_ENV') === 'development'; // Check if in development mode

  return {
    connection: {
      client: isDev ? 'sqlite' : 'postgres', // Use SQLite for development, PostgreSQL for production
      connection: isDev
        ? {
            filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')), // SQLite file location
          }
        : {
            connectionString: env('DATABASE_URL', null), // Optional: If DATABASE_URL is provided
            host: env('DATABASE_HOST', 'localhost'),
            port: env.int('DATABASE_PORT', 5432),
            database: env('DATABASE_NAME', 'strapi'),
            user: env('DATABASE_USERNAME', 'strapi'),
            password: env('DATABASE_PASSWORD', 'strapi'),
            ssl: env.bool('DATABASE_SSL', false) && {
              key: env('DATABASE_SSL_KEY', undefined),
              cert: env('DATABASE_SSL_CERT', undefined),
              ca: env('DATABASE_SSL_CA', undefined),
              capath: env('DATABASE_SSL_CAPATH', undefined),
              cipher: env('DATABASE_SSL_CIPHER', undefined),
              rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true), // Adjust if Railway uses self-signed certs
            },
            schema: env('DATABASE_SCHEMA', 'public'), // Default PostgreSQL schema
          },
      useNullAsDefault: isDev, // Required for SQLite
      pool: isDev
        ? { min: 0, max: 7 } // Use a smaller pool for SQLite
        : {
            min: env.int('DATABASE_POOL_MIN', 2),
            max: env.int('DATABASE_POOL_MAX', 10),
          },
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
