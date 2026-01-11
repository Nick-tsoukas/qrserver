'use strict';

/**
 * MBQ Pulse + Fan Momentum Engine
 * Unified signals contract and pulse computation
 */

const { DateTime } = require('luxon');

// ============================================================
// UNIFIED SIGNALS CONTRACT
// ============================================================

/**
 * Normalize analytics data into unified signals shape
 * @param {string} entityType - 'band' | 'event' | 'qr'
 * @param {number} entityId
 * @param {string} rangeKey - '7d' | '30d' | '90d' | '365d'
 * @param {object} rawData - Raw analytics data from existing endpoints
 * @returns {object} Normalized signals
 */
function normalizeSignals(entityType, entityId, rangeKey, rawData) {
  const {
    totals = {},
    series = [],
    sources = [],
    mediums = [],
    countries = [],
    devices = {},
    geoList = [],
    browsers = [],
    osList = [],
    entryTypes = [],
  } = rawData;

  // Normalize totals - ensure all metrics present
  const normalizedTotals = {
    views: totals.views || totals.scans || 0,
    qrScans: totals.qrScans || (entityType === 'qr' ? totals.scans : 0) || 0,
    linkClicks: totals.linkClicks || 0,
    mediaPlays: totals.mediaPlays || totals.songPlays || totals.videoPlays || 0,
    follows: totals.follows || 0,
    paymentsCount: totals.paymentsCount || 0,
    paymentsAmount: totals.paymentsAmount || 0,
  };

  // Normalize series - ensure consistent shape
  const normalizedSeries = series.map((s) => ({
    date: s.date,
    views: s.views || s.scans || 0,
    qrScans: s.qrScans || (entityType === 'qr' ? s.scans : 0) || 0,
    linkClicks: s.linkClicks || 0,
    mediaPlays: s.mediaPlays || 0,
    follows: s.follows || 0,
    paymentsCount: s.paymentsCount || 0,
  }));

  // Normalize geo
  const topCities = (geoList || [])
    .slice(0, 5)
    .map((g) => ({ name: g.city || 'Unknown', count: g.count || 0 }));

  const topCountries = (countries || [])
    .slice(0, 5)
    .map((c) => (Array.isArray(c) ? { name: c[0], count: c[1] } : { name: c.name, count: c.count }));

  // Normalize sources
  const topSources = (sources || [])
    .slice(0, 5)
    .map((s) => (Array.isArray(s) ? { name: s[0], count: s[1] } : { name: s.name, count: s.count }));

  const topMediums = (mediums || [])
    .slice(0, 5)
    .map((m) => (Array.isArray(m) ? { name: m[0], count: m[1] } : { name: m.name, count: m.count }));

  // Normalize devices
  const normalizedDevices = {
    desktop: devices.desktop || 0,
    mobile: devices.mobile || 0,
    tablet: devices.tablet || 0,
    bot: devices.bot || 0,
    unknown: devices.unknown || 0,
  };

  return {
    entityType,
    entityId,
    rangeKey,
    totals: normalizedTotals,
    series: normalizedSeries,
    geo: { topCities, topCountries },
    sources: { topSources, topMediums, topRefDomains: [] },
    devices: normalizedDevices,
  };
}

// ============================================================
// PULSE COMPUTATION
// ============================================================

/**
 * Compute pulse score, momentum state, drivers, and next best action
 * @param {object} currentSignals - Current period signals
 * @param {object} previousSignals - Previous period signals (same length, immediately preceding)
 * @returns {object} Pulse data
 */
function computePulse(currentSignals, previousSignals = null) {
  const { totals, series, geo, sources, devices } = currentSignals;

  // Handle empty data
  const totalActivity = totals.views + totals.qrScans + totals.linkClicks + totals.mediaPlays + totals.follows;
  if (totalActivity === 0) {
    return {
      pulseScore: 0,
      momentumState: 'steady',
      drivers: {
        primaryMetric: 'views',
        growthPct: 0,
        topSource: 'none',
        topCity: 'none',
        topDevice: 'unknown',
      },
      nextBestAction: {
        title: 'Get Started',
        reason: 'No activity recorded yet in this period.',
        steps: [
          'Share your QR code or link to start tracking',
          'Add UTM parameters to track campaign sources',
          'Check back after some traffic comes in',
        ],
      },
    };
  }

  // Calculate growth vs previous period
  let growthPct = 0;
  if (previousSignals) {
    const prevTotal = previousSignals.totals.views + previousSignals.totals.qrScans;
    const currTotal = totals.views + totals.qrScans;
    if (prevTotal > 0) {
      growthPct = Math.round(((currTotal - prevTotal) / prevTotal) * 100);
    } else if (currTotal > 0) {
      growthPct = 100; // New activity from zero
    }
  }

  // Calculate engagement rate (quality signal)
  const engagements = totals.linkClicks + totals.mediaPlays + totals.qrScans + totals.follows;
  const engagementRate = totals.views > 0 ? (engagements / totals.views) * 100 : 0;

  // Calculate volume score (0-40 points)
  // Log scale to handle wide range of traffic
  const volumeScore = Math.min(40, Math.round(Math.log10(totalActivity + 1) * 15));

  // Calculate growth score (0-35 points)
  let growthScore = 17.5; // Neutral at 0% growth
  if (growthPct > 0) {
    growthScore = Math.min(35, 17.5 + Math.min(growthPct, 100) * 0.175);
  } else if (growthPct < 0) {
    growthScore = Math.max(0, 17.5 + Math.max(growthPct, -100) * 0.175);
  }

  // Calculate quality score (0-25 points)
  const qualityScore = Math.min(25, Math.round(engagementRate * 2.5));

  // Final pulse score
  const pulseScore = Math.round(volumeScore + growthScore + qualityScore);

  // Determine momentum state
  let momentumState = 'steady';
  if (growthPct >= 50) {
    momentumState = 'surging';
  } else if (growthPct >= 15) {
    momentumState = 'warming';
  } else if (growthPct <= -30) {
    momentumState = 'cooling';
  }

  // Determine primary metric (highest contributor)
  const metricValues = [
    { name: 'views', value: totals.views },
    { name: 'qrScans', value: totals.qrScans },
    { name: 'linkClicks', value: totals.linkClicks },
    { name: 'mediaPlays', value: totals.mediaPlays },
    { name: 'follows', value: totals.follows },
  ];
  metricValues.sort((a, b) => b.value - a.value);
  const primaryMetric = metricValues[0].name;

  // Top source/city/device
  const topSource = sources.topSources[0]?.name || 'direct';
  const topCity = geo.topCities[0]?.name || 'unknown';
  const topDevice = Object.entries(devices)
    .filter(([k]) => k !== 'unknown' && k !== 'bot')
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'mobile';

  // Generate next best action based on signals
  const nextBestAction = generateNextBestAction(currentSignals, growthPct, engagementRate, momentumState);

  return {
    pulseScore,
    momentumState,
    drivers: {
      primaryMetric,
      growthPct,
      topSource,
      topCity,
      topDevice,
    },
    nextBestAction,
  };
}

/**
 * Generate rule-based next best action recommendation
 */
function generateNextBestAction(signals, growthPct, engagementRate, momentumState) {
  const { totals, sources, geo, devices, entityType, entityId } = signals;

  // Rule 1: Surging momentum - capitalize on it
  if (momentumState === 'surging') {
    return {
      title: 'Capitalize on Momentum',
      reason: `Traffic is up ${growthPct}% - your content is resonating!`,
      steps: [
        'Post more content while engagement is high',
        'Share your best-performing links again',
        'Consider running a promotion to amplify reach',
      ],
      cta: 'Share Now',
      deepLink: null,
    };
  }

  // Rule 2: Cooling momentum - re-engage
  if (momentumState === 'cooling') {
    return {
      title: 'Re-engage Your Audience',
      reason: `Traffic is down ${Math.abs(growthPct)}% - time to reconnect.`,
      steps: [
        'Share fresh content or updates',
        'Reach out to your email list',
        'Try a new platform or channel',
      ],
      cta: 'Update Content',
      deepLink: entityType === 'band' ? `/editband/${entityId}` : null,
    };
  }

  // Rule 3: Low engagement rate - improve content
  if (engagementRate < 10 && totals.views > 50) {
    return {
      title: 'Boost Engagement',
      reason: 'Visitors are viewing but not clicking - make your links more compelling.',
      steps: [
        'Add clear call-to-action buttons',
        'Highlight your best content at the top',
        'Test different link descriptions',
      ],
      cta: 'Edit Page',
      deepLink: entityType === 'band' ? `/editband/${entityId}` : entityType === 'qr' ? `/editqr/${entityId}` : null,
    };
  }

  // Rule 4: Heavy mobile traffic - optimize for mobile
  if (devices.mobile > devices.desktop * 2) {
    return {
      title: 'Optimize for Mobile',
      reason: `${Math.round((devices.mobile / (devices.mobile + devices.desktop + 1)) * 100)}% of your traffic is mobile.`,
      steps: [
        'Ensure all links work well on phones',
        'Use large, tappable buttons',
        'Test your page on a mobile device',
      ],
      cta: null,
      deepLink: null,
    };
  }

  // Rule 5: Single source dominance - diversify
  const topSourceCount = sources.topSources[0]?.count || 0;
  const totalViews = totals.views || 1;
  if (topSourceCount / totalViews > 0.7 && totals.views > 20) {
    return {
      title: 'Diversify Traffic Sources',
      reason: `${Math.round((topSourceCount / totalViews) * 100)}% of traffic comes from ${sources.topSources[0]?.name || 'one source'}.`,
      steps: [
        'Share on additional social platforms',
        'Add your link to email signatures',
        'Try QR codes in physical locations',
      ],
      cta: 'Create QR Code',
      deepLink: '/createqr',
    };
  }

  // Rule 6: Good QR scan ratio - expand physical presence
  if (totals.qrScans > totals.views * 0.3 && totals.qrScans > 10) {
    return {
      title: 'Expand Physical Presence',
      reason: 'QR scans are performing well - your physical placements work!',
      steps: [
        'Print more QR codes for new locations',
        'Add QR codes to merchandise',
        'Track which locations perform best',
      ],
      cta: 'View QR Codes',
      deepLink: '/dashboard',
    };
  }

  // Default: General growth advice
  return {
    title: 'Keep Building',
    reason: 'Steady activity - focus on consistent growth.',
    steps: [
      'Share your link regularly on social media',
      'Engage with fans who interact with your content',
      'Track which content drives the most clicks',
    ],
    cta: null,
    deepLink: null,
  };
}

// ============================================================
// DATA FETCHING HELPERS
// ============================================================

/**
 * Fetch raw analytics data for an entity
 */
async function fetchEntityData(strapi, entityType, entityId, days, from, to) {
  const fieldTS = 'timestamp';

  if (entityType === 'band') {
    return fetchBandData(strapi, entityId, days, from, to, fieldTS);
  } else if (entityType === 'event') {
    return fetchEventData(strapi, entityId, days, from, to, fieldTS);
  } else if (entityType === 'qr') {
    return fetchQrData(strapi, entityId, days, from, to);
  }

  return null;
}

async function fetchBandData(strapi, bandId, days, from, to, fieldTS) {
  const uidPV = 'api::band-page-view.band-page-view';
  const uidLC = 'api::link-click.link-click';
  const uidMP = 'api::media-play.media-play';
  const uidScan = 'api::scan.scan';

  const filters = {
    band: { id: bandId },
    [fieldTS]: { $gte: from, $lte: to },
  };

  const scanFilters = {
    band: { id: bandId },
    date: { $gte: from, $lte: to },
  };

  const [pvRows, lcRows, mpRows, scanRows] = await Promise.all([
    strapi.entityService.findMany(uidPV, {
      filters,
      fields: ['id', 'city', 'country', 'refSource', 'refMedium', 'deviceType', fieldTS],
      pagination: { limit: 100000 },
    }),
    strapi.entityService.findMany(uidLC, {
      filters,
      fields: ['id', fieldTS],
      pagination: { limit: 100000 },
    }),
    strapi.entityService.findMany(uidMP, {
      filters,
      fields: ['id', 'mediaType', fieldTS],
      pagination: { limit: 100000 },
    }),
    strapi.entityService.findMany(uidScan, {
      filters: scanFilters,
      fields: ['id', 'date'],
      pagination: { limit: 100000 },
    }),
  ]);

  // Build aggregations
  const by = (rows, pick) =>
    rows.reduce((m, r) => {
      const k = (pick(r) || 'unknown').toString().toLowerCase();
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {});

  const sources = Object.entries(by(pvRows, (r) => r.refSource)).sort((a, b) => b[1] - a[1]);
  const mediums = Object.entries(by(pvRows, (r) => r.refMedium)).sort((a, b) => b[1] - a[1]);
  const countries = Object.entries(by(pvRows, (r) => r.country)).sort((a, b) => b[1] - a[1]);

  const devices = pvRows.reduce(
    (m, r) => {
      const k = r.deviceType || 'unknown';
      m[k] = (m[k] || 0) + 1;
      return m;
    },
    { desktop: 0, mobile: 0, tablet: 0, bot: 0, unknown: 0 }
  );

  // Build geo list
  const geoMap = {};
  pvRows.forEach((r) => {
    const city = r.city || 'Unknown';
    if (!geoMap[city]) geoMap[city] = { city, count: 0 };
    geoMap[city].count++;
  });
  const geoList = Object.values(geoMap).sort((a, b) => b.count - a.count);

  // Build time series
  const now = DateTime.utc();
  const bucket = {};
  for (let i = 0; i < days; i++) {
    const d = now.minus({ days: days - 1 - i }).toISODate();
    bucket[d] = { date: d, views: 0, qrScans: 0, linkClicks: 0, mediaPlays: 0 };
  }

  pvRows.forEach((r) => {
    const ts = r[fieldTS] || r.createdAt;
    if (!ts) return;
    const d = DateTime.fromISO(ts, { zone: 'utc' }).toISODate();
    if (bucket[d]) bucket[d].views++;
  });

  lcRows.forEach((r) => {
    const ts = r[fieldTS] || r.createdAt;
    if (!ts) return;
    const d = DateTime.fromISO(ts, { zone: 'utc' }).toISODate();
    if (bucket[d]) bucket[d].linkClicks++;
  });

  mpRows.forEach((r) => {
    const ts = r[fieldTS] || r.createdAt;
    if (!ts) return;
    const d = DateTime.fromISO(ts, { zone: 'utc' }).toISODate();
    if (bucket[d]) bucket[d].mediaPlays++;
  });

  scanRows.forEach((r) => {
    const ts = r.date || r.createdAt;
    if (!ts) return;
    const d = DateTime.fromISO(ts, { zone: 'utc' }).toISODate();
    if (bucket[d]) bucket[d].qrScans++;
  });

  const series = Object.values(bucket);

  return {
    totals: {
      views: pvRows.length,
      qrScans: scanRows.length,
      linkClicks: lcRows.length,
      mediaPlays: mpRows.length,
    },
    series,
    sources,
    mediums,
    countries,
    devices,
    geoList,
  };
}

async function fetchEventData(strapi, eventId, days, from, to, fieldTS) {
  const uidEPV = 'api::event-page-view.event-page-view';

  const rows = await strapi.entityService.findMany(uidEPV, {
    filters: { event: { id: eventId }, [fieldTS]: { $gte: from, $lte: to } },
    fields: ['id', 'city', 'country', 'refSource', 'refMedium', 'deviceType', 'entryType', fieldTS],
    pagination: { limit: 100000 },
  });

  const by = (rows, pick) =>
    rows.reduce((m, r) => {
      const k = (pick(r) || 'unknown').toString().toLowerCase();
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {});

  const sources = Object.entries(by(rows, (r) => r.refSource)).sort((a, b) => b[1] - a[1]);
  const mediums = Object.entries(by(rows, (r) => r.refMedium)).sort((a, b) => b[1] - a[1]);
  const countries = Object.entries(by(rows, (r) => r.country)).sort((a, b) => b[1] - a[1]);

  const devices = rows.reduce(
    (m, r) => {
      const k = r.deviceType || 'unknown';
      m[k] = (m[k] || 0) + 1;
      return m;
    },
    { desktop: 0, mobile: 0, tablet: 0, bot: 0, unknown: 0 }
  );

  // QR scans from entryType
  const qrScans = rows.filter((r) => r.entryType === 'qr').length;

  const geoMap = {};
  rows.forEach((r) => {
    const city = r.city || 'Unknown';
    if (!geoMap[city]) geoMap[city] = { city, count: 0 };
    geoMap[city].count++;
  });
  const geoList = Object.values(geoMap).sort((a, b) => b.count - a.count);

  const now = DateTime.utc();
  const bucket = {};
  for (let i = 0; i < days; i++) {
    const d = now.minus({ days: days - 1 - i }).toISODate();
    bucket[d] = { date: d, views: 0, qrScans: 0 };
  }

  rows.forEach((r) => {
    const ts = r[fieldTS] || r.createdAt;
    if (!ts) return;
    const d = DateTime.fromISO(ts, { zone: 'utc' }).toISODate();
    if (bucket[d]) {
      bucket[d].views++;
      if (r.entryType === 'qr') bucket[d].qrScans++;
    }
  });

  const series = Object.values(bucket);

  return {
    totals: { views: rows.length, qrScans },
    series,
    sources,
    mediums,
    countries,
    devices,
    geoList,
  };
}

async function fetchQrData(strapi, qrId, days, from, to) {
  const uidScan = 'api::scan.scan';

  const rows = await strapi.entityService.findMany(uidScan, {
    filters: { qr: { id: qrId }, date: { $gte: from, $lte: to } },
    fields: ['id', 'city', 'country', 'refSource', 'refMedium', 'deviceType', 'date'],
    pagination: { limit: 100000 },
  });

  const by = (rows, pick) =>
    rows.reduce((m, r) => {
      const k = (pick(r) || 'unknown').toString().toLowerCase();
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {});

  const sources = Object.entries(by(rows, (r) => r.refSource)).sort((a, b) => b[1] - a[1]);
  const mediums = Object.entries(by(rows, (r) => r.refMedium)).sort((a, b) => b[1] - a[1]);
  const countries = Object.entries(by(rows, (r) => r.country)).sort((a, b) => b[1] - a[1]);

  const devices = rows.reduce(
    (m, r) => {
      const k = r.deviceType || 'unknown';
      m[k] = (m[k] || 0) + 1;
      return m;
    },
    { desktop: 0, mobile: 0, tablet: 0, bot: 0, unknown: 0 }
  );

  const geoMap = {};
  rows.forEach((r) => {
    const city = r.city || 'Unknown';
    if (!geoMap[city]) geoMap[city] = { city, count: 0 };
    geoMap[city].count++;
  });
  const geoList = Object.values(geoMap).sort((a, b) => b.count - a.count);

  const now = DateTime.utc();
  const bucket = {};
  for (let i = 0; i < days; i++) {
    const d = now.minus({ days: days - 1 - i }).toISODate();
    bucket[d] = { date: d, scans: 0 };
  }

  rows.forEach((r) => {
    const ts = r.date || r.createdAt;
    if (!ts) return;
    const d = DateTime.fromISO(ts, { zone: 'utc' }).toISODate();
    if (bucket[d]) bucket[d].scans++;
  });

  const series = Object.values(bucket);

  return {
    totals: { scans: rows.length, qrScans: rows.length },
    series,
    sources,
    mediums,
    countries,
    devices,
    geoList,
  };
}

module.exports = {
  normalizeSignals,
  computePulse,
  fetchEntityData,
};
