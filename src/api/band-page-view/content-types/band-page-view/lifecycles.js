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

function classify({ refDomain, utmSource, utmMedium, pageUrl, referrer, siteHost }) {
  // If UTM source present, trust it
  if (utmSource) {
    const medium = utmMedium || guessMediumBySource(utmSource);
    return { refSource: utmSource.toLowerCase(), refMedium: medium };
  }

  // No UTM: derive by domain
  if (!refDomain) {
    // no referrer → either direct or internal (when navigation stays on same host)
    const pageHost = hostOf(pageUrl);
    if (pageHost && pageHost === siteHost) return { refSource: 'internal', refMedium: 'internal' };
    return { refSource: 'direct', refMedium: 'direct' };
  }

  // Search engines
  for (const [label, rx] of SEARCH_DOMAINS) {
    if (rx.test(refDomain)) return { refSource: label, refMedium: 'organic' };
  }
  // Social
  for (const [label, rx] of SOCIAL_DOMAINS) {
    if (rx.test(refDomain)) return { refSource: label, refMedium: 'social' };
  }
  // Default referral
  return { refSource: refDomain, refMedium: 'referral' };
}

function guessMediumBySource(src = '') {
  const s = src.toLowerCase();
  if (['facebook','instagram','x','twitter','tiktok','youtube','reddit','linkedin','social'].some(k => s.includes(k))) return 'social';
  if (['google','bing','duckduckgo','yahoo','baidu','search'].some(k => s.includes(k))) return 'organic';
  if (['email','newsletter'].some(k => s.includes(k))) return 'email';
  if (['cpc','ppc','paid','ads','adwords'].some(k => s.includes(k))) return 'paid';
  return 'referral';
}

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    const pageUrl = data.pageUrl || '';
    const referrer = data.referrer || '';
    const landingPath  = data.landingPath || pathOf(pageUrl);
    const landingQuery = data.landingQuery || queryOf(pageUrl);

    const siteHost = process.env.PUBLIC_HOSTNAME || 'musicbizqr.com';
    const refDomain = data.refDomain || hostOf(referrer);

    const qp = paramsFrom(pageUrl);
    const utmSource   = data.utmSource   || qp.utm_source || '';
    const utmMedium   = data.utmMedium   || qp.utm_medium || '';
    const utmCampaign = data.utmCampaign || qp.utm_campaign || '';
    const utmTerm     = data.utmTerm     || qp.utm_term || '';
    const utmContent  = data.utmContent  || qp.utm_content || '';
    const gclid       = data.gclid  || qp.gclid  || '';
    const fbclid      = data.fbclid || qp.fbclid || '';
    const ttclid      = data.ttclid || qp.ttclid || '';
    const twclid      = data.twclid || qp.twclid || '';

    const { refSource, refMedium } = classify({
      refDomain, utmSource, utmMedium, pageUrl, referrer, siteHost
    });

    Object.assign(data, {
      landingPath, landingQuery,
      refDomain, refSource, refMedium,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent,
      gclid, fbclid, ttclid, twclid
    });
  }
};
