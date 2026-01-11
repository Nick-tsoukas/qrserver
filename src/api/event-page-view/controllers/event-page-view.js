'use strict';

/**
 * event-page-view controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event-page-view.event-page-view', ({ strapi }) => ({
  /**
   * POST /event-page-views/track
   * Custom tracking endpoint that extracts Cloudflare headers for geo data
   */
  async track(ctx) {
    try {
      const body = ctx.request.body || {};
      const data = body.data || body;

      // Extract Cloudflare headers (privacy-safe - no raw IP stored)
      const headers = ctx.request.headers || {};
      
      // Cloudflare geo headers
      const cfCountry = headers['cf-ipcountry'] || headers['x-vercel-ip-country'] || '';
      const cfCity = headers['cf-ipcity'] || headers['x-vercel-ip-city'] || '';
      const cfRegion = headers['cf-region'] || headers['x-vercel-ip-country-region'] || '';
      const cfLat = headers['cf-iplat'] || headers['x-vercel-ip-latitude'] || '';
      const cfLon = headers['cf-iplon'] || headers['x-vercel-ip-longitude'] || '';
      
      // Determine geo source
      let geoSource = 'none';
      if (cfCountry || cfCity) {
        geoSource = headers['cf-ray'] ? 'cloudflare' : 'external';
      }

      // Build the record data
      const recordData = {
        event: data.event || data.eventId,
        band: data.band || data.bandId || null,
        timestamp: data.timestamp || new Date().toISOString(),
        title: data.title || '',
        pageUrl: data.pageUrl || data.url || '',
        referrer: data.referrer || headers['referer'] || '',
        userAgent: data.userAgent || headers['user-agent'] || '',
        path: data.path || '',
        
        // Geo from Cloudflare headers
        country: data.country || cfCountry || '',
        city: data.city || cfCity || '',
        region: data.region || cfRegion || '',
        lat: data.lat || (cfLat ? parseFloat(cfLat) : null),
        lon: data.lon || (cfLon ? parseFloat(cfLon) : null),
        geoSource,
        
        // Client-provided data
        screenW: data.screenW || data.screenWidth || null,
        screenH: data.screenH || data.screenHeight || null,
        tzOffset: data.tzOffset || data.timezoneOffset || null,
        lang: data.lang || data.language || headers['accept-language']?.split(',')[0] || '',
        pageLoadMs: data.pageLoadMs || null,
        
        // Session tracking (privacy-safe)
        sessionId: data.sessionId || '',
        visitorId: data.visitorId || '',
        
        // QR entry tracking
        entryType: data.entryType || 'web',
        qrId: data.qrId || null,
        qrScanId: data.qrScanId || null,
        
        // Host info
        host: data.host || headers['host'] || '',
        protocol: data.protocol || (headers['x-forwarded-proto'] || 'https'),
      };

      // Create the record (lifecycle hooks will enrich it)
      const record = await strapi.entityService.create('api::event-page-view.event-page-view', {
        data: recordData,
      });

      ctx.body = { ok: true, id: record.id };
    } catch (err) {
      strapi.log.error('[event-page-view.track]', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || 'Internal Server Error' };
    }
  },
}));
