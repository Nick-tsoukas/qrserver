// src/middlewares/log-raw.js
module.exports = (config, { strapi }) => {
    return async (ctx, next) => {
      await next();

      const isStripeWebhookPath =
        ctx.path === '/api/stripe/webhook' ||
        ctx.path === '/stripe/webhook' ||
        ctx.path === '/webhooks/stripe' ||
        ctx.path === '/api/stripe/connect/webhook' ||
        ctx.path === '/stripe/connect/webhook';

      if (isStripeWebhookPath) {
        strapi.log.debug('🚦 [RAW] Incoming headers:', JSON.stringify(ctx.request.headers));

        const raw = ctx.request.body?.[Symbol.for('unparsedBody')];
        if (raw) {
          const preview = Buffer.isBuffer(raw) ? raw.toString('utf8', 0, 200) : String(raw).slice(0, 200);
          strapi.log.debug('🚦 [RAW] unparsedBody preview:', preview);
        } else {
          strapi.log.debug('🚦 [RAW] unparsedBody missing (body parser may not be configured)');
        }
      }
    };
  };