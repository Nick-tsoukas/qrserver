'use strict';

/**
 * MBQ Shareables v1 — Unified Evaluator
 * Generates the best shareable "Wrapped-style" cards in music.
 * 
 * 10 Card Types:
 * - CITY_CLAIM, MOMENTUM_SURGE, AFTER_SHOW_ENERGY, NEW_CITY_UNLOCKED
 * - RETURNING_FANS, SHARE_CHAIN, ENGAGED_SESSIONS, PLATFORM_PULL
 * - PEAK_HOUR, MILESTONE_DROP
 */

const { DateTime } = require('luxon');

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const CARD_TYPES = {
  CITY_CLAIM: 'CITY_CLAIM',
  MOMENTUM_SURGE: 'MOMENTUM_SURGE',
  AFTER_SHOW_ENERGY: 'AFTER_SHOW_ENERGY',
  NEW_CITY_UNLOCKED: 'NEW_CITY_UNLOCKED',
  RETURNING_FANS: 'RETURNING_FANS',
  SHARE_CHAIN: 'SHARE_CHAIN',
  ENGAGED_SESSIONS: 'ENGAGED_SESSIONS',
  PLATFORM_PULL: 'PLATFORM_PULL',
  PEAK_HOUR: 'PEAK_HOUR',
  MILESTONE_DROP: 'MILESTONE_DROP',
};

const WINDOW_LABELS = {
  '2h': 'Last 2h',
  '24h': 'Last 24h',
  '7d': 'Last 7d',
  '30d': 'Last 30d',
};

// Base scores by card type (rarity/prestige)
const BASE_SCORES = {
  [CARD_TYPES.MILESTONE_DROP]: 90,
  [CARD_TYPES.AFTER_SHOW_ENERGY]: 85,
  [CARD_TYPES.NEW_CITY_UNLOCKED]: 82,
  [CARD_TYPES.MOMENTUM_SURGE]: 80,
  [CARD_TYPES.CITY_CLAIM]: 78,
  [CARD_TYPES.SHARE_CHAIN]: 74,
  [CARD_TYPES.PLATFORM_PULL]: 72,
  [CARD_TYPES.RETURNING_FANS]: 70,
  [CARD_TYPES.ENGAGED_SESSIONS]: 68,
  [CARD_TYPES.PEAK_HOUR]: 66,
};

// Category families for diversity
const CATEGORY_FAMILIES = {
  geo: [CARD_TYPES.CITY_CLAIM, CARD_TYPES.NEW_CITY_UNLOCKED],
  growth: [CARD_TYPES.MOMENTUM_SURGE, CARD_TYPES.AFTER_SHOW_ENERGY, CARD_TYPES.PEAK_HOUR],
  engagement: [CARD_TYPES.RETURNING_FANS, CARD_TYPES.ENGAGED_SESSIONS],
  distribution: [CARD_TYPES.SHARE_CHAIN, CARD_TYPES.PLATFORM_PULL],
  achievement: [CARD_TYPES.MILESTONE_DROP],
};

// Thresholds (v1 defaults - tune later)
const THRESHOLDS = {
  CITY_CLAIM: {
    minCityCount: 6,
    minVisitors: 3,
    minInteractions: 10,
    minSharePct: 50,
    altMinCount: 10,
  },
  MOMENTUM_SURGE: {
    minGrowthPct: 80,
    minInteractions: 8,
  },
  AFTER_SHOW_ENERGY: {
    minPeakCount: 6,
    peakMultiplier: 2,
    nightHours: [19, 20, 21, 22, 23, 0, 1],
  },
  NEW_CITY_UNLOCKED: {
    minCityCount: 3,
  },
  RETURNING_FANS: {
    minReturningRate: 25,
    minInteractions: 12,
  },
  SHARE_CHAIN: {
    minShares: 2,
  },
  ENGAGED_SESSIONS: {
    minAvgTime: 60,
    minInteractions: 10,
    minEngagedSessions: 5,
  },
  PLATFORM_PULL: {
    minClicks: 5,
    minSharePct: 45,
  },
  PEAK_HOUR: {
    minPeakCount: 5,
    peakMultiplier: 1.8,
  },
  MILESTONE_DROP: {
    thresholds: {
      interactions: [50, 100, 250, 500, 1000, 2500, 5000],
      visitors: [25, 50, 100, 250, 500],
      cities: [5, 10, 25, 50],
    },
  },
};

// Accent colors by card type
const ACCENTS = {
  [CARD_TYPES.CITY_CLAIM]: 'violet',
  [CARD_TYPES.MOMENTUM_SURGE]: 'blue',
  [CARD_TYPES.AFTER_SHOW_ENERGY]: 'rose',
  [CARD_TYPES.NEW_CITY_UNLOCKED]: 'emerald',
  [CARD_TYPES.RETURNING_FANS]: 'amber',
  [CARD_TYPES.SHARE_CHAIN]: 'blue',
  [CARD_TYPES.ENGAGED_SESSIONS]: 'violet',
  [CARD_TYPES.PLATFORM_PULL]: 'emerald',
  [CARD_TYPES.PEAK_HOUR]: 'amber',
  [CARD_TYPES.MILESTONE_DROP]: 'rose',
};

// ============================================================
// MAIN EVALUATOR
// ============================================================

/**
 * Evaluate shareables for a band
 * @param {object} strapi - Strapi instance
 * @param {object} options - { bandId, windows, dev }
 * @returns {Promise<object>} { ok, cards, recommended, debug? }
 */
async function evaluateShareables(strapi, options) {
  const { bandId, windows = ['2h', '24h', '7d', '30d'], dev = false } = options;
  const startTime = Date.now();

  // Get band info
  const band = await strapi.entityService.findOne('api::band.band', bandId, {
    fields: ['id', 'name', 'slug'],
  });

  if (!band) {
    return { ok: false, error: 'Band not found' };
  }

  const bandContext = {
    bandId,
    bandName: band.name || 'This Artist',
    bandSlug: band.slug || '',
  };

  // Load metrics for all windows + previous periods
  const featuresByWindow = {};
  const debugReasons = [];

  for (const windowKey of windows) {
    const current = await loadWindowMetrics(strapi, bandId, windowKey, false);
    const previous = await loadWindowMetrics(strapi, bandId, windowKey, true);
    
    const features = computeFeatures(current, previous, windowKey);
    featuresByWindow[windowKey] = features;
  }

  // Generate cards from all windows
  const allCards = [];
  const generators = [
    makeCityClaim,
    makeMomentumSurge,
    makeAfterShowEnergy,
    makeNewCityUnlocked,
    makeReturningFans,
    makeShareChain,
    makeEngagedSessions,
    makePlatformPull,
    makePeakHour,
    makeMilestoneDrop,
  ];

  for (const generator of generators) {
    const card = generator(featuresByWindow, bandContext, debugReasons);
    if (card) {
      allCards.push(card);
    }
  }

  // Score and sort cards
  const scoredCards = allCards.map(card => ({
    ...card,
    score: computeScore(card, featuresByWindow),
  }));

  scoredCards.sort((a, b) => b.score - a.score);

  // Build recommended list (top 4 with diversity)
  const recommended = buildRecommended(scoredCards, 4);

  const result = {
    ok: true,
    bandId,
    generatedAt: new Date().toISOString(),
    recommended,
    cards: scoredCards,
  };

  // Add debug info if requested
  if (dev || process.env.NODE_ENV === 'development') {
    result.debug = {
      features: featuresByWindow,
      reasons: debugReasons,
      timing: Date.now() - startTime,
    };
  }

  return result;
}

// ============================================================
// METRICS LOADING
// ============================================================

/**
 * Load metrics for a specific time window
 */
async function loadWindowMetrics(strapi, bandId, windowKey, isPrevious = false) {
  const now = DateTime.utc();
  let from, to;

  // Calculate time range
  const windowHours = {
    '2h': 2,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
  };

  const hours = windowHours[windowKey] || 24;

  if (isPrevious) {
    to = now.minus({ hours }).toISO();
    from = now.minus({ hours: hours * 2 }).toISO();
  } else {
    to = now.toISO();
    from = now.minus({ hours }).toISO();
  }

  // Fetch all data in parallel
  const [pageViews, linkClicks, mediaPlays, shares] = await Promise.all([
    fetchPageViews(strapi, bandId, from, to),
    fetchLinkClicks(strapi, bandId, from, to),
    fetchMediaPlays(strapi, bandId, from, to),
    fetchShares(strapi, bandId, from, to),
  ]);

  // Aggregate metrics
  const totalInteractions = pageViews.length + linkClicks.length + mediaPlays.length;

  // City counts
  const cityMap = {};
  pageViews.forEach(pv => {
    const city = pv.city || 'Unknown';
    if (city !== 'Unknown') {
      cityMap[city] = (cityMap[city] || 0) + 1;
    }
  });
  const cityCounts = Object.entries(cityMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Unique visitors
  const visitorIds = new Set();
  pageViews.forEach(pv => {
    if (pv.visitorId) visitorIds.add(pv.visitorId);
  });
  const uniqueVisitors = visitorIds.size || null;

  // Platform clicks (from link labels/URLs)
  const platformMap = {};
  const platformPatterns = {
    spotify: /spotify/i,
    apple: /apple|music\.apple/i,
    youtube: /youtube|youtu\.be/i,
    soundcloud: /soundcloud/i,
    instagram: /instagram/i,
    tiktok: /tiktok/i,
    bandcamp: /bandcamp/i,
  };

  linkClicks.forEach(lc => {
    const label = (lc.linkLabel || lc.linkUrl || '').toLowerCase();
    for (const [platform, pattern] of Object.entries(platformPatterns)) {
      if (pattern.test(label)) {
        platformMap[platform] = (platformMap[platform] || 0) + 1;
        break;
      }
    }
  });

  // Hourly counts (for peak hour detection)
  const hourlyCounts = {};
  for (let h = 0; h < 24; h++) hourlyCounts[h] = 0;

  pageViews.forEach(pv => {
    if (pv.timestamp) {
      const hour = DateTime.fromISO(pv.timestamp).hour;
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    }
  });

  // Find peak hour
  let peakHour = null;
  let maxCount = 0;
  for (const [hour, count] of Object.entries(hourlyCounts)) {
    if (count > maxCount) {
      maxCount = count;
      peakHour = { hour: parseInt(hour), count };
    }
  }

  // Calculate median hourly
  const hourlyValues = Object.values(hourlyCounts).filter(v => v > 0);
  hourlyValues.sort((a, b) => a - b);
  const medianHourly = hourlyValues.length > 0
    ? hourlyValues[Math.floor(hourlyValues.length / 2)]
    : 0;

  // Session-based returning rate (approximate)
  const sessionIds = new Set();
  const returningSessionIds = new Set();
  pageViews.forEach(pv => {
    if (pv.sessionId) {
      if (sessionIds.has(pv.sessionId)) {
        returningSessionIds.add(pv.sessionId);
      }
      sessionIds.add(pv.sessionId);
    }
  });
  const returningRate = sessionIds.size > 0
    ? Math.round((returningSessionIds.size / sessionIds.size) * 100)
    : null;

  return {
    totalInteractions,
    uniqueVisitors,
    cityCounts,
    uniqueCities: cityCounts.length,
    platformClicks: platformMap,
    sharesCount: shares.length,
    hourlyCounts,
    peakHour,
    medianHourly,
    returningRate,
    avgTimeOnPageSec: null, // Not available yet
    engagedSessions: null, // Not available yet
    rawCounts: {
      pageViews: pageViews.length,
      linkClicks: linkClicks.length,
      mediaPlays: mediaPlays.length,
      shares: shares.length,
    },
  };
}

async function fetchPageViews(strapi, bandId, from, to) {
  try {
    return await strapi.entityService.findMany('api::band-page-view.band-page-view', {
      filters: {
        band: { id: bandId },
        timestamp: { $gte: from, $lte: to },
      },
      fields: ['id', 'city', 'country', 'visitorId', 'sessionId', 'timestamp'],
      pagination: { limit: 100000 },
    }) || [];
  } catch (err) {
    return [];
  }
}

async function fetchLinkClicks(strapi, bandId, from, to) {
  try {
    return await strapi.entityService.findMany('api::link-click.link-click', {
      filters: {
        band: { id: bandId },
        timestamp: { $gte: from, $lte: to },
      },
      fields: ['id', 'linkLabel', 'linkUrl', 'timestamp'],
      pagination: { limit: 100000 },
    }) || [];
  } catch (err) {
    return [];
  }
}

async function fetchMediaPlays(strapi, bandId, from, to) {
  try {
    return await strapi.entityService.findMany('api::media-play.media-play', {
      filters: {
        band: { id: bandId },
        timestamp: { $gte: from, $lte: to },
      },
      fields: ['id', 'mediaType', 'mediaTitle', 'timestamp'],
      pagination: { limit: 100000 },
    }) || [];
  } catch (err) {
    return [];
  }
}

async function fetchShares(strapi, bandId, from, to) {
  try {
    return await strapi.entityService.findMany('api::band-share.band-share', {
      filters: {
        band: { id: bandId },
        timestamp: { $gte: from, $lte: to },
      },
      fields: ['id', 'timestamp'],
      pagination: { limit: 100000 },
    }) || [];
  } catch (err) {
    return [];
  }
}

// ============================================================
// FEATURE COMPUTATION
// ============================================================

function computeFeatures(current, previous, windowKey) {
  const topCity = current.cityCounts[0] || null;
  const topCitySharePct = topCity && current.totalInteractions > 0
    ? Math.round((topCity.count / current.totalInteractions) * 100)
    : 0;

  // Growth calculation (safe for prev=0)
  let growthPct = null;
  if (previous.totalInteractions > 0) {
    growthPct = Math.round(
      ((current.totalInteractions - previous.totalInteractions) / previous.totalInteractions) * 100
    );
  }

  // Top platform
  const platformEntries = Object.entries(current.platformClicks);
  platformEntries.sort((a, b) => b[1] - a[1]);
  const topPlatform = platformEntries[0]
    ? {
        name: platformEntries[0][0],
        count: platformEntries[0][1],
        sharePct: current.rawCounts.linkClicks > 0
          ? Math.round((platformEntries[0][1] / current.rawCounts.linkClicks) * 100)
          : 0,
      }
    : null;

  // New cities (compare to 30d lookback - simplified: just check if city is new in this window)
  // For now, we'll mark cities with low historical presence as "new"
  const newCities = current.cityCounts.filter(c => c.count >= 3 && c.count <= 10);

  // Milestones
  const milestonesHit = [];
  const { thresholds } = THRESHOLDS.MILESTONE_DROP;

  for (const threshold of thresholds.interactions) {
    if (current.totalInteractions >= threshold && previous.totalInteractions < threshold) {
      milestonesHit.push(`${threshold} INTERACTIONS`);
    }
  }

  if (current.uniqueVisitors) {
    for (const threshold of thresholds.visitors) {
      if (current.uniqueVisitors >= threshold && (!previous.uniqueVisitors || previous.uniqueVisitors < threshold)) {
        milestonesHit.push(`${threshold} FANS`);
      }
    }
  }

  for (const threshold of thresholds.cities) {
    if (current.uniqueCities >= threshold && previous.uniqueCities < threshold) {
      milestonesHit.push(`${threshold} CITIES`);
    }
  }

  return {
    window: windowKey,
    windowLabel: WINDOW_LABELS[windowKey],
    totalInteractions: current.totalInteractions,
    uniqueVisitors: current.uniqueVisitors,
    uniqueCities: current.uniqueCities,
    topCity: topCity ? { ...topCity, sharePct: topCitySharePct } : null,
    growthPct,
    prevTotal: previous.totalInteractions,
    sharesCount: current.sharesCount,
    prevSharesCount: previous.sharesCount,
    returningRate: current.returningRate,
    avgTimeOnPageSec: current.avgTimeOnPageSec,
    engagedSessions: current.engagedSessions,
    topPlatform,
    peakHour: current.peakHour,
    medianHourly: current.medianHourly,
    newCities,
    milestonesHit,
    platformClicks: current.platformClicks,
  };
}

// ============================================================
// CARD GENERATORS
// ============================================================

function makeCityClaim(featuresByWindow, bandContext, debugReasons) {
  // Prefer 24h window
  const preferredWindows = ['24h', '7d', '2h'];
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f || !f.topCity) continue;

    const { minCityCount, minVisitors, minInteractions, minSharePct, altMinCount } = THRESHOLDS.CITY_CLAIM;
    
    const cityCount = f.topCity.count;
    const visitors = f.uniqueVisitors || f.totalInteractions;
    const sharePct = f.topCity.sharePct;

    // Check thresholds
    if (cityCount < minCityCount) continue;
    if (visitors < minVisitors && f.totalInteractions < minInteractions) continue;
    if (sharePct < minSharePct && cityCount < altMinCount) continue;

    const cityTitle = titleCase(f.topCity.name);

    debugReasons.push({
      type: CARD_TYPES.CITY_CLAIM,
      window: windowKey,
      triggered: true,
      reason: `City ${cityTitle} has ${cityCount} fans (${sharePct}% share)`,
    });

    return {
      id: `${CARD_TYPES.CITY_CLAIM}:${windowKey}:${f.topCity.name}`,
      type: CARD_TYPES.CITY_CLAIM,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `📍 ${cityTitle.toUpperCase()} IS HEATING UP`,
      hero: `${cityCount} FANS`,
      proof: sharePct >= 30 ? `${sharePct}% OF TRAFFIC • ${f.windowLabel.toUpperCase()}` : `TOP CITY • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `${cityTitle} is showing love 🔥`,
        grateful: `${cityTitle}, thank you for the love 🙏`,
        tease: `${cityTitle}… we see you 👀`,
      },
      accent: ACCENTS[CARD_TYPES.CITY_CLAIM],
      context: {
        city: f.topCity.name,
        count: cityCount,
        sharePct,
        window: windowKey,
      },
    };
  }

  return null;
}

function makeMomentumSurge(featuresByWindow, bandContext, debugReasons) {
  const preferredWindows = ['2h', '24h'];
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f) continue;

    const { minGrowthPct, minInteractions } = THRESHOLDS.MOMENTUM_SURGE;

    // Must have previous data and meaningful growth
    if (f.growthPct === null || f.prevTotal === 0) continue;
    if (f.growthPct < minGrowthPct) continue;
    if (f.totalInteractions < minInteractions) continue;

    debugReasons.push({
      type: CARD_TYPES.MOMENTUM_SURGE,
      window: windowKey,
      triggered: true,
      reason: `Growth ${f.growthPct}% with ${f.totalInteractions} interactions`,
    });

    return {
      id: `${CARD_TYPES.MOMENTUM_SURGE}:${windowKey}`,
      type: CARD_TYPES.MOMENTUM_SURGE,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `⚡ MOMENTUM SURGE`,
      hero: `+${f.growthPct}%`,
      proof: `ACTIVITY UP • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `It's starting to move 🔥`,
        grateful: `Thank you for pushing this forward 🙏`,
        tease: `This is only the beginning 👀`,
      },
      accent: ACCENTS[CARD_TYPES.MOMENTUM_SURGE],
      context: {
        growthPct: f.growthPct,
        totalInteractions: f.totalInteractions,
        prevTotal: f.prevTotal,
        window: windowKey,
      },
    };
  }

  return null;
}

function makeAfterShowEnergy(featuresByWindow, bandContext, debugReasons) {
  const f = featuresByWindow['24h'];
  if (!f || !f.peakHour) return null;

  const { minPeakCount, peakMultiplier, nightHours } = THRESHOLDS.AFTER_SHOW_ENERGY;

  // Check if peak is during night hours (show time)
  if (!nightHours.includes(f.peakHour.hour)) return null;
  if (f.peakHour.count < minPeakCount) return null;
  if (f.medianHourly > 0 && f.peakHour.count < f.medianHourly * peakMultiplier) return null;

  debugReasons.push({
    type: CARD_TYPES.AFTER_SHOW_ENERGY,
    window: '24h',
    triggered: true,
    reason: `Peak at ${f.peakHour.hour}:00 with ${f.peakHour.count} hits (median: ${f.medianHourly})`,
  });

  return {
    id: `${CARD_TYPES.AFTER_SHOW_ENERGY}:24h`,
    type: CARD_TYPES.AFTER_SHOW_ENERGY,
    window: '24h',
    windowLabel: f.windowLabel,
    headline: `🎤 AFTER-SHOW ENERGY`,
    hero: `${f.totalInteractions} INTERACTIONS`,
    proof: `PEAK AT ${formatHour(f.peakHour.hour)} • LAST 24H`,
    microCaption: {
      hype: `Last night hit different 🔥`,
      grateful: `We felt every second of it 🙏`,
      tease: `If you missed it… 👀`,
    },
    accent: ACCENTS[CARD_TYPES.AFTER_SHOW_ENERGY],
    context: {
      peakHour: f.peakHour,
      totalInteractions: f.totalInteractions,
      window: '24h',
    },
  };
}

function makeNewCityUnlocked(featuresByWindow, bandContext, debugReasons) {
  const preferredWindows = ['7d', '30d', '24h'];
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f || !f.newCities || f.newCities.length === 0) continue;

    const { minCityCount } = THRESHOLDS.NEW_CITY_UNLOCKED;
    const newCity = f.newCities.find(c => c.count >= minCityCount);
    if (!newCity) continue;

    const cityTitle = titleCase(newCity.name);

    debugReasons.push({
      type: CARD_TYPES.NEW_CITY_UNLOCKED,
      window: windowKey,
      triggered: true,
      reason: `New city ${cityTitle} with ${newCity.count} fans`,
    });

    return {
      id: `${CARD_TYPES.NEW_CITY_UNLOCKED}:${windowKey}:${newCity.name}`,
      type: CARD_TYPES.NEW_CITY_UNLOCKED,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `🗺️ NEW CITY UNLOCKED`,
      hero: cityTitle.toUpperCase(),
      proof: `FIRST TIME • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `${cityTitle} just unlocked 🔥`,
        grateful: `Love to ${cityTitle} 🙏`,
        tease: `${cityTitle}… hello 👀`,
      },
      accent: ACCENTS[CARD_TYPES.NEW_CITY_UNLOCKED],
      context: {
        city: newCity.name,
        count: newCity.count,
        window: windowKey,
      },
    };
  }

  return null;
}

function makeReturningFans(featuresByWindow, bandContext, debugReasons) {
  const preferredWindows = ['24h', '7d'];
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f || f.returningRate === null) continue;

    const { minReturningRate, minInteractions } = THRESHOLDS.RETURNING_FANS;

    if (f.returningRate < minReturningRate) continue;
    if (f.totalInteractions < minInteractions) continue;

    debugReasons.push({
      type: CARD_TYPES.RETURNING_FANS,
      window: windowKey,
      triggered: true,
      reason: `${f.returningRate}% returning rate with ${f.totalInteractions} interactions`,
    });

    return {
      id: `${CARD_TYPES.RETURNING_FANS}:${windowKey}`,
      type: CARD_TYPES.RETURNING_FANS,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `🔁 FANS ARE COMING BACK`,
      hero: `${f.returningRate}% RETURNING`,
      proof: `LOYALTY UP • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `The real ones are coming back 🔥`,
        grateful: `We appreciate you 🙏`,
        tease: `More coming soon 👀`,
      },
      accent: ACCENTS[CARD_TYPES.RETURNING_FANS],
      context: {
        returningRate: f.returningRate,
        window: windowKey,
      },
    };
  }

  return null;
}

function makeShareChain(featuresByWindow, bandContext, debugReasons) {
  const preferredWindows = ['24h', '7d'];
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f) continue;

    const { minShares } = THRESHOLDS.SHARE_CHAIN;

    if (f.sharesCount < minShares) continue;
    if (f.sharesCount <= f.prevSharesCount) continue;

    debugReasons.push({
      type: CARD_TYPES.SHARE_CHAIN,
      window: windowKey,
      triggered: true,
      reason: `${f.sharesCount} shares (prev: ${f.prevSharesCount})`,
    });

    return {
      id: `${CARD_TYPES.SHARE_CHAIN}:${windowKey}`,
      type: CARD_TYPES.SHARE_CHAIN,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `🔗 LINKS ARE GETTING SHARED`,
      hero: `${f.sharesCount} SHARES`,
      proof: `FANS SHARED YOUR PAGE • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `The share chain is real 🔥`,
        grateful: `Thank you for sharing 🙏`,
        tease: `Something's spreading 👀`,
      },
      accent: ACCENTS[CARD_TYPES.SHARE_CHAIN],
      context: {
        sharesCount: f.sharesCount,
        prevSharesCount: f.prevSharesCount,
        window: windowKey,
      },
    };
  }

  return null;
}

function makeEngagedSessions(featuresByWindow, bandContext, debugReasons) {
  const preferredWindows = ['24h', '7d'];
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f) continue;

    const { minAvgTime, minInteractions, minEngagedSessions } = THRESHOLDS.ENGAGED_SESSIONS;

    // Check either avg time or engaged sessions
    const hasAvgTime = f.avgTimeOnPageSec !== null && f.avgTimeOnPageSec >= minAvgTime;
    const hasEngaged = f.engagedSessions !== null && f.engagedSessions >= minEngagedSessions;

    if (!hasAvgTime && !hasEngaged) continue;
    if (f.totalInteractions < minInteractions) continue;

    const heroText = hasAvgTime
      ? `AVG ${formatMinSec(f.avgTimeOnPageSec)}`
      : `${f.engagedSessions} DEEP SESSIONS`;

    debugReasons.push({
      type: CARD_TYPES.ENGAGED_SESSIONS,
      window: windowKey,
      triggered: true,
      reason: hasAvgTime ? `Avg time ${f.avgTimeOnPageSec}s` : `${f.engagedSessions} engaged sessions`,
    });

    return {
      id: `${CARD_TYPES.ENGAGED_SESSIONS}:${windowKey}`,
      type: CARD_TYPES.ENGAGED_SESSIONS,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `🧠 THEY STAYED FOR IT`,
      hero: heroText,
      proof: `REAL ATTENTION • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `They didn't just click — they stayed 🔥`,
        grateful: `Thanks for the time 🙏`,
        tease: `Wait til you see what's next 👀`,
      },
      accent: ACCENTS[CARD_TYPES.ENGAGED_SESSIONS],
      context: {
        avgTimeOnPageSec: f.avgTimeOnPageSec,
        engagedSessions: f.engagedSessions,
        window: windowKey,
      },
    };
  }

  return null;
}

function makePlatformPull(featuresByWindow, bandContext, debugReasons) {
  const preferredWindows = ['24h', '7d'];
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f || !f.topPlatform) continue;

    const { minClicks, minSharePct } = THRESHOLDS.PLATFORM_PULL;

    if (f.topPlatform.count < minClicks) continue;
    if (f.topPlatform.sharePct < minSharePct) continue;

    const platformName = titleCase(f.topPlatform.name);

    debugReasons.push({
      type: CARD_TYPES.PLATFORM_PULL,
      window: windowKey,
      triggered: true,
      reason: `${platformName} has ${f.topPlatform.count} clicks (${f.topPlatform.sharePct}% share)`,
    });

    return {
      id: `${CARD_TYPES.PLATFORM_PULL}:${windowKey}:${f.topPlatform.name}`,
      type: CARD_TYPES.PLATFORM_PULL,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `🎧 ${platformName.toUpperCase()} IS HITTING`,
      hero: `${f.topPlatform.count} CLICKS`,
      proof: `TOP PLATFORM • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `${platformName} is popping 🔥`,
        grateful: `Appreciate the listens 🙏`,
        tease: `More on the way 👀`,
      },
      accent: ACCENTS[CARD_TYPES.PLATFORM_PULL],
      context: {
        platform: f.topPlatform.name,
        count: f.topPlatform.count,
        sharePct: f.topPlatform.sharePct,
        window: windowKey,
      },
    };
  }

  return null;
}

function makePeakHour(featuresByWindow, bandContext, debugReasons) {
  const f = featuresByWindow['24h'];
  if (!f || !f.peakHour) return null;

  const { minPeakCount, peakMultiplier } = THRESHOLDS.PEAK_HOUR;

  if (f.peakHour.count < minPeakCount) return null;
  if (f.medianHourly > 0 && f.peakHour.count < f.medianHourly * peakMultiplier) return null;

  // Don't duplicate with AFTER_SHOW_ENERGY
  const nightHours = THRESHOLDS.AFTER_SHOW_ENERGY.nightHours;
  if (nightHours.includes(f.peakHour.hour)) return null;

  debugReasons.push({
    type: CARD_TYPES.PEAK_HOUR,
    window: '24h',
    triggered: true,
    reason: `Peak at ${f.peakHour.hour}:00 with ${f.peakHour.count} hits`,
  });

  return {
    id: `${CARD_TYPES.PEAK_HOUR}:24h`,
    type: CARD_TYPES.PEAK_HOUR,
    window: '24h',
    windowLabel: f.windowLabel,
    headline: `⏰ PEAK HOUR: ${formatHour(f.peakHour.hour)}`,
    hero: `${f.peakHour.count} HITS`,
    proof: `BEST TIME • LAST 24H`,
    microCaption: {
      hype: `That hour went off 🔥`,
      grateful: `Thank you for pulling up 🙏`,
      tease: `Try again tomorrow 👀`,
    },
    accent: ACCENTS[CARD_TYPES.PEAK_HOUR],
    context: {
      peakHour: f.peakHour,
      window: '24h',
    },
  };
}

function makeMilestoneDrop(featuresByWindow, bandContext, debugReasons) {
  // Check all windows for milestones
  for (const windowKey of ['24h', '7d', '30d']) {
    const f = featuresByWindow[windowKey];
    if (!f || !f.milestonesHit || f.milestonesHit.length === 0) continue;

    // Pick highest prestige milestone
    const milestone = f.milestonesHit[0];

    debugReasons.push({
      type: CARD_TYPES.MILESTONE_DROP,
      window: windowKey,
      triggered: true,
      reason: `Milestone hit: ${milestone}`,
    });

    return {
      id: `${CARD_TYPES.MILESTONE_DROP}:${windowKey}:${milestone}`,
      type: CARD_TYPES.MILESTONE_DROP,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `🏆 MILESTONE UNLOCKED`,
      hero: milestone,
      proof: `${f.windowLabel.toUpperCase()} • KEEP IT GOING`,
      microCaption: {
        hype: `We just leveled up 🔥`,
        grateful: `Couldn't do it without you 🙏`,
        tease: `Next one is coming 👀`,
      },
      accent: ACCENTS[CARD_TYPES.MILESTONE_DROP],
      context: {
        milestone,
        window: windowKey,
      },
    };
  }

  return null;
}

// ============================================================
// SCORING & RECOMMENDED
// ============================================================

function computeScore(card, featuresByWindow) {
  let score = BASE_SCORES[card.type] || 50;
  const f = featuresByWindow[card.window];

  // Freshness bonus
  if (card.window === '2h' || card.window === '24h') {
    score += 5;
  }

  // Magnitude bonuses
  if (card.context) {
    // Growth bonus
    if (card.context.growthPct) {
      score += Math.min(10, Math.floor(card.context.growthPct / 20));
    }

    // City share bonus
    if (card.context.sharePct && card.context.sharePct >= 70) {
      score += 5;
    }

    // Shares bonus
    if (card.context.sharesCount) {
      score += Math.min(5, card.context.sharesCount);
    }

    // Milestone tier bonus
    if (card.context.milestone) {
      const milestoneValue = parseInt(card.context.milestone) || 0;
      if (milestoneValue >= 1000) score += 5;
      else if (milestoneValue >= 500) score += 3;
      else if (milestoneValue >= 250) score += 2;
    }
  }

  // Low sample penalty
  if (f && f.totalInteractions < 8) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function buildRecommended(scoredCards, maxCount = 4) {
  const recommended = [];
  const familyCounts = {};

  for (const card of scoredCards) {
    if (recommended.length >= maxCount) break;

    // Find card's family
    let cardFamily = null;
    for (const [family, types] of Object.entries(CATEGORY_FAMILIES)) {
      if (types.includes(card.type)) {
        cardFamily = family;
        break;
      }
    }

    // Check diversity (max 2 per family)
    if (cardFamily) {
      const count = familyCounts[cardFamily] || 0;
      if (count >= 2) continue;
      familyCounts[cardFamily] = count + 1;
    }

    recommended.push(card);
  }

  return recommended;
}

// ============================================================
// UTILITIES
// ============================================================

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function formatHour(hour) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}${ampm}`;
}

function formatMinSec(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  evaluateShareables,
  CARD_TYPES,
  THRESHOLDS,
  BASE_SCORES,
};
