'use strict';

/**
 * scan controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

// Simple UA parsing (same logic as lifecycle)
function parseUserAgent(ua) {
  if (!ua) return { deviceType: 'unknown', os: null, browser: null };

  // Device type
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = 'tablet';
  }

  // OS detection
  let os = null;
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/cros/i.test(ua)) os = 'ChromeOS';

  // Browser detection
  let browser = null;
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/opera|opr\//i.test(ua)) browser = 'Opera';
  else if (/msie|trident/i.test(ua)) browser = 'IE';

  return { deviceType, os, browser };
}

// Extract domain from URL
function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Classify source/medium from referrer domain
function classifySource(refDomain, utmSource, utmMedium) {
  if (utmSource) {
    return {
      refSource: utmSource.toLowerCase(),
      refMedium: utmMedium?.toLowerCase() || 'campaign',
    };
  }

  if (!refDomain) {
    return { refSource: 'direct', refMedium: 'none' };
  }

  const domain = refDomain.toLowerCase();

  if (/google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\./i.test(domain)) {
    return { refSource: domain.split('.')[0], refMedium: 'organic' };
  }

  if (/facebook\.|fb\.|instagram\.|twitter\.|x\.com|tiktok\.|linkedin\.|pinterest\.|snapchat\.|youtube\.|reddit\./i.test(domain)) {
    const social = domain.replace(/\.com|\.net|\.org/g, '').split('.').pop();
    return { refSource: social, refMedium: 'social' };
  }

  if (/mail\.|gmail\.|outlook\.|yahoo\.com\/mail|mailchimp\.|sendgrid\./i.test(domain)) {
    return { refSource: 'email', refMedium: 'email' };
  }

  return { refSource: domain, refMedium: 'referral' };
}

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
      // Debug: log incoming data
      strapi.log.info('[scan.track] Creating scan with data:', JSON.stringify({
        qr: scanData.qr,
        userAgent: scanData.userAgent?.substring(0, 50),
        country: scanData.country,
        geoSource: scanData.geoSource,
        referrer: scanData.referrer,
      }));

      const entry = await strapi.entityService.create('api::scan.scan', {
        data: scanData,
      });

      // Debug: log created entry
      strapi.log.info('[scan.track] Created scan:', JSON.stringify({
        id: entry.id,
        deviceType: entry.deviceType,
        refSource: entry.refSource,
        country: entry.country,
      }));

      ctx.body = { data: entry };
    } catch (err) {
      strapi.log.error('Scan track error:', err);
      ctx.throw(500, 'Failed to create scan');
    }
  },

  /**
   * Backfill endpoint to parse userAgent and classify source for existing scans
   * POST /api/scans/backfill
   */
  async backfill(ctx) {
    const { qrId, limit = 1000 } = ctx.request.body || {};

    try {
      // Build filters
      const filters = {};
      if (qrId) {
        filters.qr = { id: qrId };
      }

      // Find scans that need backfill (missing deviceType or refSource)
      const scans = await strapi.entityService.findMany('api::scan.scan', {
        filters: {
          ...filters,
          $or: [
            { deviceType: { $null: true } },
            { refSource: { $null: true } },
          ],
        },
        fields: ['id', 'userAgent', 'referrer', 'utmSource', 'utmMedium', 'deviceType', 'os', 'browser', 'refSource', 'refMedium', 'refDomain'],
        limit: Number(limit),
      });

      strapi.log.info(`[scan.backfill] Found ${scans.length} scans to backfill`);

      let updated = 0;
      let skipped = 0;

      for (const scan of scans) {
        const updates = {};

        // Parse user agent if needed
        if (!scan.deviceType && scan.userAgent) {
          const parsed = parseUserAgent(scan.userAgent);
          updates.deviceType = parsed.deviceType;
          updates.os = scan.os || parsed.os;
          updates.browser = scan.browser || parsed.browser;
        } else if (!scan.deviceType) {
          // No userAgent, set to unknown
          updates.deviceType = 'unknown';
        }

        // Extract refDomain if needed
        let refDomain = scan.refDomain;
        if (!refDomain && scan.referrer) {
          refDomain = extractDomain(scan.referrer);
          updates.refDomain = refDomain;
        }

        // Classify source if needed
        if (!scan.refSource) {
          const classified = classifySource(refDomain, scan.utmSource, scan.utmMedium);
          updates.refSource = classified.refSource;
          updates.refMedium = scan.refMedium || classified.refMedium;
        }

        // Update if we have changes
        if (Object.keys(updates).length > 0) {
          await strapi.entityService.update('api::scan.scan', scan.id, {
            data: updates,
          });
          updated++;
        } else {
          skipped++;
        }
      }

      strapi.log.info(`[scan.backfill] Updated ${updated}, skipped ${skipped}`);

      ctx.body = {
        ok: true,
        found: scans.length,
        updated,
        skipped,
      };
    } catch (err) {
      strapi.log.error('[scan.backfill] Error:', err);
      ctx.throw(500, 'Backfill failed');
    }
  },
}));
