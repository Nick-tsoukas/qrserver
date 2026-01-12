'use strict';

const { DateTime } = require('luxon');

const RECAP_RATE_LIMIT_HOURS = 12;
const RECAP_EXPIRY_HOURS = 72;
const PEAK_WINDOW_MINUTES = 60;
const LOOKBACK_HOURS = 6;
const MIN_PEAK_INTERACTIONS = 20;

const ENERGY_LABELS = {
  WARM: { min: 20, max: 49, label: 'Warm' },
  HOT: { min: 50, max: 99, label: 'Hot' },
  ON_FIRE: { min: 100, max: Infinity, label: 'On Fire' },
};

function getEnergyLabel(count) {
  if (count >= ENERGY_LABELS.ON_FIRE.min) return ENERGY_LABELS.ON_FIRE.label;
  if (count >= ENERGY_LABELS.HOT.min) return ENERGY_LABELS.HOT.label;
  if (count >= ENERGY_LABELS.WARM.min) return ENERGY_LABELS.WARM.label;
  return null;
}

const SHARE_TITLES = [
  'Last night was awesome',
  'Show recap',
  'We felt that energy',
  'Thanks for showing up',
  'What a night',
];

const SHARE_TEXTS_WITH_VENUE = [
  'Last night at {venue} was unreal. Thanks for showing love.',
  '{venue} brought the energy. We felt every moment.',
  'The vibes at {venue} were incredible. Thank you.',
];

const SHARE_TEXTS_NO_VENUE = [
  'Thanks for showing up. {bandName} felt the love.',
  'The energy was real. Thanks for being part of it.',
  'We felt that. Thank you for the love.',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildShareContent(bandName, venueName, eventTitle) {
  let shareTitle = pickRandom(SHARE_TITLES);
  let shareText;

  if (venueName) {
    shareTitle = 'Show recap: ' + venueName;
    shareText = pickRandom(SHARE_TEXTS_WITH_VENUE).replace('{venue}', venueName);
  } else if (eventTitle) {
    shareTitle = 'Show recap: ' + eventTitle;
    shareText = pickRandom(SHARE_TEXTS_NO_VENUE).replace('{bandName}', bandName);
  } else {
    shareText = pickRandom(SHARE_TEXTS_NO_VENUE).replace('{bandName}', bandName);
  }

  return { shareTitle, shareText };
}

async function fetchInteractionData(strapi, bandId, hoursBack) {
  const now = DateTime.now();
  const from = now.minus({ hours: hoursBack }).toISO();
  const to = now.toISO();

  const uidPV = 'api::band-page-view.band-page-view';
  const uidLC = 'api::link-click.link-click';
  const uidMP = 'api::media-play.media-play';
  const uidScan = 'api::scan.scan';

  const filters = {
    band: { id: bandId },
    timestamp: { $gte: from, $lte: to },
  };

  const scanFilters = {
    band: { id: bandId },
    date: { $gte: from, $lte: to },
  };

  const [pvRows, lcRows, mpRows, scanRows] = await Promise.all([
    strapi.entityService.findMany(uidPV, {
      filters,
      fields: ['id', 'timestamp', 'city', 'country'],
      pagination: { limit: 10000 },
    }).catch(() => []),
    strapi.entityService.findMany(uidLC, {
      filters,
      fields: ['id', 'timestamp', 'linkUrl', 'linkLabel'],
      pagination: { limit: 10000 },
    }).catch(() => []),
    strapi.entityService.findMany(uidMP, {
      filters,
      fields: ['id', 'timestamp', 'mediaType', 'mediaTitle'],
      pagination: { limit: 10000 },
    }).catch(() => []),
    strapi.entityService.findMany(uidScan, {
      filters: scanFilters,
      fields: ['id', 'date'],
      pagination: { limit: 10000 },
    }).catch(() => []),
  ]);

  const interactions = [];

  pvRows.forEach(row => {
    if (row.timestamp) {
      interactions.push({
        type: 'page_view',
        timestamp: row.timestamp,
        city: row.city,
        country: row.country,
      });
    }
  });

  lcRows.forEach(row => {
    if (row.timestamp) {
      interactions.push({
        type: 'link_click',
        timestamp: row.timestamp,
        linkUrl: row.linkUrl,
        linkLabel: row.linkLabel,
      });
    }
  });

  mpRows.forEach(row => {
    if (row.timestamp) {
      interactions.push({
        type: 'media_play',
        timestamp: row.timestamp,
        mediaType: row.mediaType,
        mediaTitle: row.mediaTitle,
      });
    }
  });

  scanRows.forEach(row => {
    if (row.date) {
      interactions.push({
        type: 'qr_scan',
        timestamp: row.date,
      });
    }
  });

  return interactions;
}

function findPeakWindow(interactions, windowMinutes = PEAK_WINDOW_MINUTES) {
  if (interactions.length === 0) {
    return { peakStart: null, peakEnd: null, peakCount: 0, peakInteractions: [] };
  }

  const sorted = [...interactions].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let maxCount = 0;
  let bestStart = null;
  let bestEnd = null;
  let bestInteractions = [];

  for (let i = 0; i < sorted.length; i++) {
    const windowStart = new Date(sorted[i].timestamp);
    const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);

    const windowInteractions = sorted.filter(item => {
      const ts = new Date(item.timestamp);
      return ts >= windowStart && ts <= windowEnd;
    });

    if (windowInteractions.length > maxCount) {
      maxCount = windowInteractions.length;
      bestStart = windowStart.toISOString();
      bestEnd = windowEnd.toISOString();
      bestInteractions = windowInteractions;
    }
  }

  return {
    peakStart: bestStart,
    peakEnd: bestEnd,
    peakCount: maxCount,
    peakInteractions: bestInteractions,
  };
}

function computeTopCity(interactions) {
  const cityCounts = {};
  interactions.forEach(i => {
    if (i.city) {
      cityCounts[i.city] = (cityCounts[i.city] || 0) + 1;
    }
  });

  const entries = Object.entries(cityCounts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0], count: entries[0][1] };
}

function computeTopLink(interactions) {
  const linkCounts = {};
  interactions.forEach(i => {
    if (i.type === 'link_click' && i.linkUrl) {
      const key = i.linkUrl;
      if (!linkCounts[key]) {
        linkCounts[key] = { url: i.linkUrl, label: i.linkLabel || i.linkUrl, count: 0 };
      }
      linkCounts[key].count++;
    }
  });

  const entries = Object.values(linkCounts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b.count - a.count);
  return entries[0];
}

function computeTopMedia(interactions) {
  const mediaCounts = {};
  interactions.forEach(i => {
    if (i.type === 'media_play' && i.mediaTitle) {
      const key = i.mediaTitle;
      if (!mediaCounts[key]) {
        mediaCounts[key] = { type: i.mediaType || 'unknown', title: i.mediaTitle, count: 0 };
      }
      mediaCounts[key].count++;
    }
  });

  const entries = Object.values(mediaCounts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b.count - a.count);
  return entries[0];
}

async function checkRateLimit(strapi, bandId) {
  const now = DateTime.now();
  const cutoff = now.minus({ hours: RECAP_RATE_LIMIT_HOURS }).toISO();

  const existing = await strapi.db.query('api::fan-moment.fan-moment').findMany({
    where: {
      band: { id: bandId },
      actionType: 'AUTO',
      momentType: 'AFTER_SHOW_RECAP',
      createdAt: { $gte: cutoff },
    },
    limit: 1,
  });

  return existing.length > 0;
}

async function checkActiveRecap(strapi, bandId) {
  const now = DateTime.now().toISO();

  const existing = await strapi.db.query('api::fan-moment.fan-moment').findMany({
    where: {
      band: { id: bandId },
      actionType: 'AUTO',
      momentType: 'AFTER_SHOW_RECAP',
      expiresAt: { $gt: now },
    },
    limit: 1,
  });

  return existing.length > 0;
}

async function fetchBandInfo(strapi, bandId) {
  try {
    const band = await strapi.entityService.findOne('api::band.band', bandId, {
      fields: ['name', 'slug'],
    });
    return band || { name: 'This Artist', slug: '' };
  } catch {
    return { name: 'This Artist', slug: '' };
  }
}

async function evaluateBand(strapi, bandId, dryRun = false) {
  const result = {
    bandId,
    evaluated: true,
    created: false,
    reason: null,
    momentType: null,
    context: null,
  };

  const hasActiveRecap = await checkActiveRecap(strapi, bandId);
  if (hasActiveRecap) {
    result.reason = 'Active recap already exists';
    return result;
  }

  const rateLimited = await checkRateLimit(strapi, bandId);
  if (rateLimited) {
    result.reason = 'Rate limited (recap created within last 12 hours)';
    return result;
  }

  const interactions = await fetchInteractionData(strapi, bandId, LOOKBACK_HOURS);
  
  if (interactions.length < MIN_PEAK_INTERACTIONS) {
    result.reason = 'Not enough total interactions in lookback window';
    return result;
  }

  const peak = findPeakWindow(interactions, PEAK_WINDOW_MINUTES);

  if (peak.peakCount < MIN_PEAK_INTERACTIONS) {
    result.reason = 'Peak window below threshold (' + peak.peakCount + ' < ' + MIN_PEAK_INTERACTIONS + ')';
    return result;
  }

  const energyLabel = getEnergyLabel(peak.peakCount);
  const topCity = computeTopCity(peak.peakInteractions);
  const topLink = computeTopLink(peak.peakInteractions);
  const topMedia = computeTopMedia(peak.peakInteractions);

  const bandInfo = await fetchBandInfo(strapi, bandId);
  const { shareTitle, shareText } = buildShareContent(bandInfo.name, null, null);

  const context = {
    kind: 'recap',
    bandId,
    bandName: bandInfo.name,
    peakWindowStart: peak.peakStart,
    peakWindowEnd: peak.peakEnd,
    totalInteractions: peak.peakCount,
    energyLabel,
  };

  if (topCity) context.topCity = topCity;
  if (topLink) context.topLink = topLink;
  if (topMedia) context.topMedia = topMedia;

  result.momentType = 'AFTER_SHOW_RECAP';
  result.context = context;

  if (dryRun) {
    result.reason = 'Dry run - would create recap';
    result.created = false;
    return result;
  }

  const now = DateTime.now();
  const expiresAt = now.plus({ hours: RECAP_EXPIRY_HOURS }).toISO();

  await strapi.entityService.create('api::fan-moment.fan-moment', {
    data: {
      band: bandId,
      visitorId: null,
      sessionId: null,
      momentType: 'AFTER_SHOW_RECAP',
      actionType: 'AUTO',
      expiresAt,
      shareTitle,
      shareText,
      context,
    },
  });

  result.created = true;
  result.reason = 'Recap created successfully';

  strapi.log.info('[recapMoment] Created AFTER_SHOW_RECAP for band ' + bandId + ' with ' + peak.peakCount + ' peak interactions');

  return result;
}

async function evaluateAllBands(strapi, dryRun = false) {
  const now = DateTime.now();
  const cutoff = now.minus({ hours: 24 }).toISO();

  const recentViews = await strapi.db.query('api::band-page-view.band-page-view').findMany({
    select: ['id'],
    where: {
      timestamp: { $gte: cutoff },
    },
    populate: {
      band: {
        select: ['id'],
      },
    },
    limit: 10000,
  });

  const bandIds = [...new Set(
    recentViews
      .filter(v => v.band?.id)
      .map(v => v.band.id)
  )];

  strapi.log.info('[recapMoment] Evaluating ' + bandIds.length + ' bands with recent activity');

  const results = {
    evaluated: 0,
    created: 0,
    createdMoments: [],
    details: [],
  };

  for (const bandId of bandIds) {
    try {
      const evalResult = await evaluateBand(strapi, bandId, dryRun);
      results.evaluated++;
      results.details.push(evalResult);

      if (evalResult.created) {
        results.created++;
        results.createdMoments.push({
          bandId: evalResult.bandId,
          momentType: evalResult.momentType,
          context: evalResult.context,
        });
      }
    } catch (err) {
      strapi.log.error('[recapMoment] Error evaluating band ' + bandId + ':', err);
    }
  }

  return results;
}

async function getActiveRecap(strapi, bandId) {
  const now = DateTime.now().toISO();

  const recaps = await strapi.db.query('api::fan-moment.fan-moment').findMany({
    where: {
      band: { id: bandId },
      actionType: 'AUTO',
      momentType: 'AFTER_SHOW_RECAP',
      expiresAt: { $gt: now },
    },
    orderBy: { createdAt: 'desc' },
    limit: 1,
    populate: ['band'],
  });

  if (recaps.length === 0) return null;

  const recap = recaps[0];
  return {
    id: recap.id,
    momentType: recap.momentType,
    actionType: recap.actionType,
    expiresAt: recap.expiresAt,
    shareTitle: recap.shareTitle,
    shareText: recap.shareText,
    shareImageUrl: recap.shareImageUrl,
    context: recap.context,
    band: recap.band ? { id: recap.band.id, name: recap.band.name } : null,
    createdAt: recap.createdAt,
  };
}

module.exports = {
  evaluateBand,
  evaluateAllBands,
  getActiveRecap,
  MIN_PEAK_INTERACTIONS,
  RECAP_RATE_LIMIT_HOURS,
  RECAP_EXPIRY_HOURS,
};
