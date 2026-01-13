'use strict';

/**
 * Lifecycle hooks for scan - auto-enrich with device parsing and source classification
 */

// Simple UA parsing (same logic as event-page-view)
function parseUserAgent(ua) {
  if (!ua) return { deviceType: 'unknown', os: null, browser: null };

  const uaLower = ua.toLowerCase();

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

  // Search engines
  if (/google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\./i.test(domain)) {
    return { refSource: domain.split('.')[0], refMedium: 'organic' };
  }

  // Social networks
  if (/facebook\.|fb\.|instagram\.|twitter\.|x\.com|tiktok\.|linkedin\.|pinterest\.|snapchat\.|youtube\.|reddit\./i.test(domain)) {
    const social = domain.replace(/\.com|\.net|\.org/g, '').split('.').pop();
    return { refSource: social, refMedium: 'social' };
  }

  // Email providers
  if (/mail\.|gmail\.|outlook\.|yahoo\.com\/mail|mailchimp\.|sendgrid\./i.test(domain)) {
    return { refSource: 'email', refMedium: 'email' };
  }

  // Default: referral
  return { refSource: domain, refMedium: 'referral' };
}

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    strapi.log.info('[scan.lifecycle] beforeCreate called with:', JSON.stringify({
      hasUserAgent: !!data.userAgent,
      deviceType: data.deviceType,
      refSource: data.refSource,
      country: data.country,
    }));

    // Parse user agent if not already parsed
    if (data.userAgent && !data.deviceType) {
      const parsed = parseUserAgent(data.userAgent);
      data.deviceType = parsed.deviceType;
      data.os = data.os || parsed.os;
      data.browser = data.browser || parsed.browser;
      strapi.log.info('[scan.lifecycle] Parsed UA:', JSON.stringify(parsed));
    }

    // Extract refDomain from referrer
    if (data.referrer && !data.refDomain) {
      data.refDomain = extractDomain(data.referrer);
    }

    // Classify source/medium if not set
    if (!data.refSource || !data.refMedium) {
      const classified = classifySource(data.refDomain, data.utmSource, data.utmMedium);
      data.refSource = data.refSource || classified.refSource;
      data.refMedium = data.refMedium || classified.refMedium;
      strapi.log.info('[scan.lifecycle] Classified source:', JSON.stringify(classified));
    }

    // Auto-link event from QR if QR has an event relation
    if (data.qr && !data.event) {
      try {
        const qr = await strapi.entityService.findOne('api::qr.qr', data.qr, {
          populate: ['event', 'band'],
        });
        if (qr?.event?.id) {
          data.event = qr.event.id;
        }
        if (qr?.band?.id && !data.band) {
          data.band = qr.band.id;
        }
      } catch (err) {
        // Non-blocking
      }
    }

    // Ensure date is set
    if (!data.date) {
      data.date = new Date().toISOString();
    }
  },
};
