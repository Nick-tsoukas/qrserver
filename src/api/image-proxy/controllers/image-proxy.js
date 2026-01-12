'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::image-proxy.image-proxy', ({ strapi }) => ({
  async proxy(ctx) {
    const { url } = ctx.query;

    if (!url) {
      return ctx.badRequest('Missing url parameter');
    }

    // Only allow proxying from trusted domains
    const allowedDomains = [
      'res.cloudinary.com',
      'cloudinary.com',
      'images.unsplash.com',
      'localhost',
    ];

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return ctx.badRequest('Invalid URL');
    }

    const isAllowed = allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
    if (!isAllowed) {
      return ctx.forbidden('Domain not allowed');
    }

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        return ctx.notFound('Image not found');
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = await response.arrayBuffer();

      ctx.set('Content-Type', contentType);
      ctx.set('Access-Control-Allow-Origin', '*');
      ctx.set('Cache-Control', 'public, max-age=86400');
      
      ctx.body = Buffer.from(buffer);
    } catch (err) {
      strapi.log.error('[image-proxy] Failed to fetch image:', err);
      return ctx.internalServerError('Failed to fetch image');
    }
  },
}));
