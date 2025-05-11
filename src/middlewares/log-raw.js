// src/middlewares/log-raw.js
module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
      if (ctx.path === '/api/stripe/webhook') {
        // Log all incoming headers
        strapi.log.debug('🚦 [RAW] Incoming headers:', JSON.stringify(ctx.request.headers));
  
        // Log Koa’s rawBody if it’s already there (sometimes on production)
        strapi.log.debug('🚦 [RAW] ctx.request.rawBody:', ctx.request.rawBody);
  
        // Manually collect the raw data from the Node request stream
        let data = '';
        ctx.req.on('data', (chunk) => { data += chunk; });
        ctx.req.on('end', () => {
          strapi.log.debug('🚦 [RAW] collected req stream:', data.slice(0,200));
        });
      }
      await next();
    };
  };
  