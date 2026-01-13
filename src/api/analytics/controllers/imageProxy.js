'use strict';

/**
 * Image Proxy Controller
 * Proxies images from CORS-restricted sources (S3, etc.)
 * GET /api/image-proxy?url=<encoded-url>
 */

module.exports = {
  async proxy(ctx) {
    const { url } = ctx.query;

    if (!url) {
      return ctx.badRequest('url parameter is required');
    }

    // Decode the URL
    let imageUrl;
    try {
      imageUrl = decodeURIComponent(url);
    } catch (e) {
      return ctx.badRequest('Invalid URL encoding');
    }

    // Validate URL (only allow specific domains for security)
    const allowedDomains = [
      'qrcode101.s3.us-east-1.amazonaws.com',
      'qrcode101.s3.amazonaws.com',
      's3.us-east-1.amazonaws.com',
      's3.amazonaws.com',
    ];

    let urlObj;
    try {
      urlObj = new URL(imageUrl);
    } catch (e) {
      return ctx.badRequest('Invalid URL');
    }

    const isAllowed = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      strapi.log.warn(`[imageProxy] Blocked request for non-allowed domain: ${urlObj.hostname}`);
      return ctx.forbidden('Domain not allowed');
    }

    try {
      // Fetch the image
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'MusicBizQR-ImageProxy/1.0',
        },
      });

      if (!response.ok) {
        strapi.log.warn(`[imageProxy] Failed to fetch image: ${response.status} ${imageUrl}`);
        return ctx.notFound('Image not found');
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'image/png';
      
      // Validate it's actually an image
      if (!contentType.startsWith('image/')) {
        return ctx.badRequest('URL does not point to an image');
      }

      // Get the image data
      const imageBuffer = await response.arrayBuffer();

      // Set response headers
      ctx.set('Content-Type', contentType);
      ctx.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      ctx.set('Access-Control-Allow-Origin', '*');

      // Return the image
      ctx.body = Buffer.from(imageBuffer);
    } catch (err) {
      strapi.log.error(`[imageProxy] Error fetching image:`, err);
      return ctx.internalServerError('Failed to fetch image');
    }
  },
};
