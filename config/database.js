const path = require('path');

module.exports = ({ env }) => {
  const isDev = env('NODE_ENV') === 'development';

  return {
    connection: {
      client: isDev ? 'sqlite' : 'postgres',
      connection: isDev
        ? {
            filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')),
          }
        : {
            connectionString: env('DATABASE_URL'),
            ssl: env.bool('DATABASE_SSL', true)
              ? {
                  rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
                }
              : false,
          },
      useNullAsDefault: isDev,
      pool: isDev
        ? { min: 0, max: 7 }
        : {
            min: env.int('DATABASE_POOL_MIN', 2),
            max: env.int('DATABASE_POOL_MAX', 10),
          },
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
