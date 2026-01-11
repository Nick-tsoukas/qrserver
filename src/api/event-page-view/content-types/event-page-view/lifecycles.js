// /src/api/event-page-view/content-types/event-page-view/lifecycles.js
'use strict';

const SOCIAL_DOMAINS = [
  ['facebook', /(^|\.)facebook\.com$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['x', /(^|\.)twitter\.com$|(^|\.)x\.com$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['youtube', /(^|\.)youtube\.com$|(^|\.)youtu\.be$/],
  ['reddit', /(^|\.)reddit\.com$/],
  ['linkedin', /(^|\.)linkedin\.com$/]
];

const SEARCH_DOMAINS = [
  ['google', /(^|\.)google\./],
  ['bing', /(^|\.)bing\.com$/],
  ['duckduckgo', /(^|\.)duckduckgo\.com$/],
  ['yahoo', /(^|\.)yahoo\.com$/]
];

function hostOf(urlStr = '') {
  try { return new URL(urlStr).hostname.toLowerCase(); }
  catch { return ''; }
}

function pathOf(urlStr = '') {
  try { const u = new URL(urlStr); return u.pathname || '/'; }
  catch { return ''; }
}

function queryOf(urlStr = '') {
  try { const u = new URL(urlStr); return u.search || ''; }
  catch { return ''; }
}

function paramsFrom(urlStr = '') {
  const out = {};
  try {
    const u = new URL(urlStr);
    for (const [k, v] of u.searchParams.entries()) out[k] = v;
  } catch {}
  return out;
}

function classify({ refDomain, utmSource, utmMedium, pageUrl, referrer, siteHost, entryType }) {
  // QR entry
  if (entryType === 'qr') {
    return { refSource: 'qr', refMedium: 'qr', sourceCategory: 'qr' };
  }

  // If UTM source present, trust it
  if (utmSource) {
    const medium = utmMedium || guessMediumBySource(utmSource);
    const category = categoryFromMedium(medium);
    return { refSource: utmSource.toLowerCase(), refMedium: medium, sourceCategory: category };
  }

  // No UTM: derive by domain
  if (!refDomain) {
    const pageHost = hostOf(pageUrl);
    if (pageHost && pageHost === siteHost) {
      return { refSource: 'internal', refMedium: 'internal', sourceCategory: 'direct' };
    }
    return { refSource: 'direct', refMedium: 'direct', sourceCategory: 'direct' };
  }

  // Search engines
  for (const [label, rx] of SEARCH_DOMAINS) {
    if (rx.test(refDomain)) {
      return { refSource: label, refMedium: 'organic', sourceCategory: 'search' };
    }
  }

  // Social
  for (const [label, rx] of SOCIAL_DOMAINS) {
    if (rx.test(refDomain)) {
      return { refSource: label, refMedium: 'social', sourceCategory: 'social' };
    }
  }

  // Default referral
  return { refSource: refDomain, refMedium: 'referral', sourceCategory: 'referral' };
}

function guessMediumBySource(src = '') {
  const s = src.toLowerCase();
  if (['facebook','instagram','x','twitter','tiktok','youtube','reddit','linkedin','social'].some(k => s.includes(k))) return 'social';
  if (['google','bing','duckduckgo','yahoo','baidu','search'].some(k => s.includes(k))) return 'organic';
  if (['email','newsletter'].some(k => s.includes(k))) return 'email';
  if (['cpc','ppc','paid','ads','adwords'].some(k => s.includes(k))) return 'paid';
  return 'referral';
}

function categoryFromMedium(medium = '') {
  const m = medium.toLowerCase();
  if (m === 'organic') return 'search';
  if (m === 'social') return 'social';
  if (m === 'email') return 'email';
  if (m === 'paid' || m === 'cpc' || m === 'ppc') return 'ads';
  if (m === 'qr') return 'qr';
  if (m === 'direct' || m === 'internal') return 'direct';
  return 'referral';
}

function parseDeviceType(ua = '') {
  const s = String(ua).toLowerCase();
  if (!s) return 'unknown';
  if (/bot|crawl|spider|slurp|headless|preview|lighthouse|pagespeed/.test(s)) return 'bot';
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/android/.test(s) && !/mobile/.test(s)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile/.test(s)) return 'mobile';
  return 'desktop';
}

function parseOS(ua = '') {
  const s = String(ua).toLowerCase();
  if (/windows/.test(s)) return 'Windows';
  if (/macintosh|mac os x/.test(s)) return 'macOS';
  if (/iphone|ipad|ipod/.test(s)) return 'iOS';
  if (/android/.test(s)) return 'Android';
  if (/linux/.test(s)) return 'Linux';
  return 'Unknown';
}

function parseBrowser(ua = '') {
  const s = String(ua).toLowerCase();
  if (/edg\//.test(s)) return 'Edge';
  if (/chrome/.test(s) && !/chromium/.test(s)) return 'Chrome';
  if (/safari/.test(s) && !/chrome/.test(s)) return 'Safari';
  if (/firefox/.test(s)) return 'Firefox';
  if (/opera|opr\//.test(s)) return 'Opera';
  return 'Unknown';
}

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    // Fetch event title and band if not provided
    const eventId = data.event;
    if (eventId) {
      const eventEntity = await strapi.entityService.findOne('api::event.event', eventId, {
        fields: ['title'],
        populate: { band: { fields: ['id'] } },
      });
      if (eventEntity) {
        data.title = data.title || eventEntity.title;
        // Link to band if event has one
        if (eventEntity.band?.id && !data.band) {
          data.band = eventEntity.band.id;
        }
      }
    }

    // Ensure timestamp
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    const pageUrl = data.pageUrl || '';
    const referrer = data.referrer || '';
    const landingPath = data.landingPath || pathOf(pageUrl);
    const landingQuery = data.landingQuery || queryOf(pageUrl);

    const siteHost = process.env.PUBLIC_HOSTNAME || 'musicbizqr.com';
    const refDomain = data.refDomain || hostOf(referrer);

    const qp = paramsFrom(pageUrl);
    const utmSource = data.utmSource || qp.utm_source || '';
    const utmMedium = data.utmMedium || qp.utm_medium || '';
    const utmCampaign = data.utmCampaign || qp.utm_campaign || '';
    const utmTerm = data.utmTerm || qp.utm_term || '';
    const utmContent = data.utmContent || qp.utm_content || '';
    const gclid = data.gclid || qp.gclid || '';
    const fbclid = data.fbclid || qp.fbclid || '';
    const ttclid = data.ttclid || qp.ttclid || '';
    const twclid = data.twclid || qp.twclid || '';

    const entryType = data.entryType || 'web';

    const { refSource, refMedium, sourceCategory } = classify({
      refDomain, utmSource, utmMedium, pageUrl, referrer, siteHost, entryType
    });

    // Parse device info from userAgent
    const userAgent = data.userAgent || '';
    const deviceType = data.deviceType || parseDeviceType(userAgent);
    const os = data.os || parseOS(userAgent);
    const browser = data.browser || parseBrowser(userAgent);

    Object.assign(data, {
      landingPath,
      landingQuery,
      refDomain,
      refSource,
      refMedium,
      sourceCategory,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      gclid,
      fbclid,
      ttclid,
      twclid,
      deviceType,
      os,
      browser,
      entryType,
    });
  }
};