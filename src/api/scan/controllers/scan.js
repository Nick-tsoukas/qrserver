'use strict';

/**
 * scan controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::scan.scan', ({ strapi }) => ({
  /**
   * Custom track endpoint that extracts Cloudflare headers for geo data
   * POST /api/scans/track
   */
  async track(ctx) {
    const body = ctx.request.body || {};
    const headers = ctx.request.headers || {};

    // Extract Cloudflare geo headers (privacy-safe, no raw IP stored)
    const cfCountry = headers['cf-ipcountry'] || null;
    const cfCity = headers['cf-ipcity'] || null;
    const cfRegion = headers['cf-region'] || null;
    const cfLat = headers['cf-iplatitude'] ? parseFloat(headers['cf-iplatitude']) : null;
    const cfLon = headers['cf-iplongitude'] ? parseFloat(headers['cf-iplongitude']) : null;

    const geoSource = cfCountry ? 'cloudflare' : 'none';

    // Build scan data with CF headers + client-provided data
    const scanData = {
      date: body.date || new Date().toISOString(),
      qr: body.qr || null,
      band: body.band || null,
      event: body.event || null,
      entryType: body.entryType || 'qr',
      // Geo from Cloudflare
      country: cfCountry,
      region: cfRegion,
      city: cfCity,
      lat: cfLat,
      lon: cfLon,
      geoSource,
      // Device/browser from client
      userAgent: body.userAgent || headers['user-agent'] || null,
      deviceType: body.deviceType || null,
      os: body.os || null,
      browser: body.browser || null,
      screenW: body.screenW || null,
      screenH: body.screenH || null,
      lang: body.lang || null,
      tzOffset: body.tzOffset || null,
      // Source/referrer
      referrer: body.referrer || headers['referer'] || null,
      refDomain: body.refDomain || null,
      refSource: body.refSource || null,
      refMedium: body.refMedium || null,
      // UTM params
      utmSource: body.utmSource || null,
      utmMedium: body.utmMedium || null,
      utmCampaign: body.utmCampaign || null,
      utmTerm: body.utmTerm || null,
      utmContent: body.utmContent || null,
      // Click IDs
      gclid: body.gclid || null,
      fbclid: body.fbclid || null,
      ttclid: body.ttclid || null,
      twclid: body.twclid || null,
      // Session
      sessionId: body.sessionId || null,
      visitorId: body.visitorId || null,
      isBot: body.isBot || false,
      botScore: body.botScore || null,
    };

    try {
      const entry = await strapi.entityService.create('api::scan.scan', {
        data: scanData,
      });

      ctx.body = { data: entry };
    } catch (err) {
      strapi.log.error('Scan track error:', err);
      ctx.throw(500, 'Failed to create scan');
    }
  },
}));
