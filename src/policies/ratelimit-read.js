'use strict';

// ultra-simple in-memory limiter (per node process)
const BUCKET = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT = 120;           // 120 req/min per IP

module.exports = async (ctx, config, { strapi }) => {
  const ip = ctx.ip || ctx.request.ip || 'unknown';
  const now = Date.now();
  const bucket = BUCKET.get(ip) || { count: 0, reset: now + WINDOW_MS };

  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + WINDOW_MS;
  }

  bucket.count += 1;
  BUCKET.set(ip, bucket);

  if (bucket.count > (config?.limit ?? LIMIT)) {
    ctx.set('Retry-After', Math.ceil((bucket.reset - now) / 1000));
    return ctx.tooManyRequests('Rate limit exceeded');
  }

  return true; // allow
};
