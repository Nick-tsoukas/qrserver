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
const { applyCooldowns, recordEmittedCards } = require('./cooldowns');

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

// ============================================================
// BASE SCORES (V1 — Per Prompt Spec)
// ============================================================
// Each card type has a base score + conditional bonuses
// Final score determines ranking and recommended set

const BASE_SCORES = {
  [CARD_TYPES.MILESTONE_DROP]: 90,      // Fixed 90 (achievement)
  [CARD_TYPES.MOMENTUM_SURGE]: 65,      // +20 if ≥100%, +10 if interactions ≥30
  [CARD_TYPES.CITY_CLAIM]: 60,          // +20 if sharePct ≥60, +10 if interactions ≥50
  [CARD_TYPES.AFTER_SHOW_ENERGY]: 60,   // +15 if ≥50 interactions, +10 if shares >0
  [CARD_TYPES.RETURNING_FANS]: 55,      // +20 if ≥40%
  [CARD_TYPES.PEAK_HOUR]: 55,           // +15 if ≥20 hits, +10 if growthPct >0
  [CARD_TYPES.PLATFORM_PULL]: 55,       // +15 if ≥25 clicks
  [CARD_TYPES.ENGAGED_SESSIONS]: 55,    // +15 if ≥2:30
  [CARD_TYPES.NEW_CITY_UNLOCKED]: 50,   // +15 if ≥2 cities, +10 if city count ≥5
  [CARD_TYPES.SHARE_CHAIN]: 50,         // +10 per share beyond 3, cap 85
};

// Category families for diversity
const CATEGORY_FAMILIES = {
  geo: [CARD_TYPES.CITY_CLAIM, CARD_TYPES.NEW_CITY_UNLOCKED],
  growth: [CARD_TYPES.MOMENTUM_SURGE, CARD_TYPES.AFTER_SHOW_ENERGY, CARD_TYPES.PEAK_HOUR],
  engagement: [CARD_TYPES.RETURNING_FANS, CARD_TYPES.ENGAGED_SESSIONS],
  distribution: [CARD_TYPES.SHARE_CHAIN, CARD_TYPES.PLATFORM_PULL],
  achievement: [CARD_TYPES.MILESTONE_DROP],
};

// ============================================================
// THRESHOLDS (V1 — Stricter, Earned Cards Only)
// ============================================================
// If a card appears, the band should instantly understand WHY.
// No random cards. No filler. No marketing fluff.

const THRESHOLDS = {
  CITY_CLAIM: {
    minCityCount: 15,        // Must have 15+ fans from top city
    minSharePct: 40,         // Top city must be 40%+ of traffic
  },
  MOMENTUM_SURGE: {
    minGrowthPct: 40,        // Must have 40%+ growth vs previous window
    minInteractions: 10,     // Minimum baseline activity
  },
  AFTER_SHOW_ENERGY: {
    minInteractions: 25,     // Must have 25+ total interactions
    spikeWindowHours: 3,     // Spike detected in 3h window
    nightHours: [19, 20, 21, 22, 23, 0, 1, 2],
  },
  NEW_CITY_UNLOCKED: {
    minNewCities: 1,         // At least 1 new city vs previous window
  },
  RETURNING_FANS: {
    minReturningPct: 25,     // 25%+ returning visitors
  },
  SHARE_CHAIN: {
    minShares: 3,            // Must have 3+ shares
  },
  ENGAGED_SESSIONS: {
    minAvgDuration: 90,      // 90 seconds average session
  },
  PLATFORM_PULL: {
    minClicks: 10,           // 10+ clicks on a single platform
  },
  PEAK_HOUR: {
    minPeakCount: 10,        // 10+ hits in peak hour
  },
  MILESTONE_DROP: {
    milestones: [50, 100, 250, 500, 1000],  // Interaction milestones
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

  // Score and sort cards (with breakdown for debug)
  const isDev = dev || process.env.NODE_ENV === 'development';
  const scoredCards = allCards.map(card => {
    const scoreResult = computeScore(card, featuresByWindow, isDev);
    return {
      ...card,
      score: isDev ? scoreResult.score : scoreResult,
      _scoreBreakdown: isDev ? scoreResult.breakdown : undefined,
    };
  });

  scoredCards.sort((a, b) => b.score - a.score);

  // Apply cooldowns BEFORE recommended selection (with fallback if cooldowns fail)
  let cooledCards = scoredCards;
  let cooldownInfo = [];
  
  try {
    const cooldownResult = await applyCooldowns(strapi, bandId, scoredCards);
    cooledCards = cooldownResult.cards;
    cooldownInfo = cooldownResult.cooldownInfo;
  } catch (cooldownErr) {
    strapi.log.warn('[shareables] Cooldown check failed, using all cards:', cooldownErr.message);
    // Continue without cooldowns if they fail
  }

  // Build recommended list (max 3 with strict variety) from cooled cards
  const recommended = buildRecommended(cooledCards, 3);

  // Record emitted cards for cooldown tracking (recommended only) - non-blocking
  if (recommended.length > 0) {
    recordEmittedCards(strapi, bandId, recommended).catch(err => {
      strapi.log.warn('[shareables] Failed to record emitted cards:', err.message);
    });
  }

  const result = {
    ok: true,
    bandId,
    generatedAt: new Date().toISOString(),
    recommended: recommended.map(c => {
      const { _scoreBreakdown, ...card } = c;
      return card;
    }),
    cards: cooledCards.map(c => {
      const { _scoreBreakdown, ...card } = c;
      return card;
    }),
  };

  // Add enhanced debug info if requested
  if (isDev) {
    result.debug = {
      timing: Date.now() - startTime,
      metricsSnapshot: featuresByWindow,
      eligibilityReasons: debugReasons,
      cooldownInfo,
      scoreBreakdowns: scoredCards.map(c => ({
        id: c.id,
        type: c.type,
        score: c.score,
        breakdown: c._scoreBreakdown,
      })),
      recommendedIds: recommended.map(c => c.id),
      skippedCards: debugReasons.filter(r => !r.triggered).map(r => ({
        type: r.type,
        window: r.window,
        reason: r.reason,
      })),
      suppressedByCooldown: cooldownInfo.filter(c => c.onCooldown).map(c => ({
        cardId: c.cardId,
        type: c.type,
        reason: c.reason,
      })),
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
        sharedAt: { $gte: from, $lte: to },
      },
      fields: ['id', 'sharedAt'],
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
  const preferredWindows = ['24h', '7d', '2h'];
  const { minCityCount, minSharePct } = THRESHOLDS.CITY_CLAIM;
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f || !f.topCity) {
      debugReasons.push({
        type: CARD_TYPES.CITY_CLAIM,
        window: windowKey,
        triggered: false,
        reason: 'No top city data',
      });
      continue;
    }

    const cityCount = f.topCity.count;
    const sharePct = f.topCity.sharePct;

    // Eligibility: topCity.count ≥ 15 AND sharePct ≥ 40%
    if (cityCount < minCityCount) {
      debugReasons.push({
        type: CARD_TYPES.CITY_CLAIM,
        window: windowKey,
        triggered: false,
        reason: `City count ${cityCount} < ${minCityCount} required`,
      });
      continue;
    }
    if (sharePct < minSharePct) {
      debugReasons.push({
        type: CARD_TYPES.CITY_CLAIM,
        window: windowKey,
        triggered: false,
        reason: `Share ${sharePct}% < ${minSharePct}% required`,
      });
      continue;
    }

    const cityTitle = titleCase(f.topCity.name);

    debugReasons.push({
      type: CARD_TYPES.CITY_CLAIM,
      window: windowKey,
      triggered: true,
      reason: `✓ City ${cityTitle}: ${cityCount} fans (${sharePct}% share)`,
    });

    return {
      id: `${CARD_TYPES.CITY_CLAIM}:${windowKey}:${f.topCity.name}`,
      type: CARD_TYPES.CITY_CLAIM,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `📍 ${cityTitle.toUpperCase()} IS HEATING UP`,
      hero: `${cityCount} FANS`,
      proof: `${sharePct}% OF TRAFFIC • ${f.windowLabel.toUpperCase()}`,
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
  const { minInteractions, nightHours } = THRESHOLDS.AFTER_SHOW_ENERGY;

  if (!f) {
    debugReasons.push({
      type: CARD_TYPES.AFTER_SHOW_ENERGY,
      window: '24h',
      triggered: false,
      reason: 'No 24h data',
    });
    return null;
  }

  // Eligibility: totalInteractions ≥ 25 AND spike in night hours
  if (f.totalInteractions < minInteractions) {
    debugReasons.push({
      type: CARD_TYPES.AFTER_SHOW_ENERGY,
      window: '24h',
      triggered: false,
      reason: `Interactions ${f.totalInteractions} < ${minInteractions} required`,
    });
    return null;
  }

  if (!f.peakHour || !nightHours.includes(f.peakHour.hour)) {
    debugReasons.push({
      type: CARD_TYPES.AFTER_SHOW_ENERGY,
      window: '24h',
      triggered: false,
      reason: f.peakHour 
        ? `Peak hour ${f.peakHour.hour} not in night hours` 
        : 'No peak hour detected',
    });
    return null;
  }

  debugReasons.push({
    type: CARD_TYPES.AFTER_SHOW_ENERGY,
    window: '24h',
    triggered: true,
    reason: `✓ ${f.totalInteractions} interactions, peak at ${formatHour(f.peakHour.hour)}`,
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
  const { minReturningPct } = THRESHOLDS.RETURNING_FANS;
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f || f.returningRate === null) {
      debugReasons.push({
        type: CARD_TYPES.RETURNING_FANS,
        window: windowKey,
        triggered: false,
        reason: 'No returning rate data',
      });
      continue;
    }

    // Eligibility: returningVisitorsPct ≥ 25%
    if (f.returningRate < minReturningPct) {
      debugReasons.push({
        type: CARD_TYPES.RETURNING_FANS,
        window: windowKey,
        triggered: false,
        reason: `Returning ${f.returningRate}% < ${minReturningPct}% required`,
      });
      continue;
    }

    debugReasons.push({
      type: CARD_TYPES.RETURNING_FANS,
      window: windowKey,
      triggered: true,
      reason: `✓ ${f.returningRate}% returning visitors`,
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
  const { minShares } = THRESHOLDS.SHARE_CHAIN;
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f) continue;

    // Eligibility: sharesCount ≥ 3
    if (f.sharesCount < minShares) {
      debugReasons.push({
        type: CARD_TYPES.SHARE_CHAIN,
        window: windowKey,
        triggered: false,
        reason: `Shares ${f.sharesCount} < ${minShares} required`,
      });
      continue;
    }

    debugReasons.push({
      type: CARD_TYPES.SHARE_CHAIN,
      window: windowKey,
      triggered: true,
      reason: `✓ ${f.sharesCount} shares`,
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
  const { minAvgDuration } = THRESHOLDS.ENGAGED_SESSIONS;
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f) continue;

    // Eligibility: avgSessionDuration ≥ 90 seconds
    if (f.avgTimeOnPageSec === null || f.avgTimeOnPageSec < minAvgDuration) {
      debugReasons.push({
        type: CARD_TYPES.ENGAGED_SESSIONS,
        window: windowKey,
        triggered: false,
        reason: f.avgTimeOnPageSec === null 
          ? 'No session duration data' 
          : `Avg ${f.avgTimeOnPageSec}s < ${minAvgDuration}s required`,
      });
      continue;
    }

    debugReasons.push({
      type: CARD_TYPES.ENGAGED_SESSIONS,
      window: windowKey,
      triggered: true,
      reason: `✓ Avg session ${formatMinSec(f.avgTimeOnPageSec)}`,
    });

    return {
      id: `${CARD_TYPES.ENGAGED_SESSIONS}:${windowKey}`,
      type: CARD_TYPES.ENGAGED_SESSIONS,
      window: windowKey,
      windowLabel: f.windowLabel,
      headline: `🧠 THEY STAYED FOR IT`,
      hero: `AVG ${formatMinSec(f.avgTimeOnPageSec)}`,
      proof: `REAL ATTENTION • ${f.windowLabel.toUpperCase()}`,
      microCaption: {
        hype: `They didn't just click — they stayed 🔥`,
        grateful: `Thanks for the time 🙏`,
        tease: `Wait til you see what's next 👀`,
      },
      accent: ACCENTS[CARD_TYPES.ENGAGED_SESSIONS],
      context: {
        avgTimeOnPageSec: f.avgTimeOnPageSec,
        window: windowKey,
      },
    };
  }

  return null;
}

function makePlatformPull(featuresByWindow, bandContext, debugReasons) {
  const preferredWindows = ['24h', '7d'];
  const { minClicks } = THRESHOLDS.PLATFORM_PULL;
  
  for (const windowKey of preferredWindows) {
    const f = featuresByWindow[windowKey];
    if (!f || !f.topPlatform) {
      debugReasons.push({
        type: CARD_TYPES.PLATFORM_PULL,
        window: windowKey,
        triggered: false,
        reason: 'No platform click data',
      });
      continue;
    }

    // Eligibility: any platformClicks ≥ 10
    if (f.topPlatform.count < minClicks) {
      debugReasons.push({
        type: CARD_TYPES.PLATFORM_PULL,
        window: windowKey,
        triggered: false,
        reason: `${titleCase(f.topPlatform.name)} clicks ${f.topPlatform.count} < ${minClicks} required`,
      });
      continue;
    }

    const platformName = titleCase(f.topPlatform.name);

    debugReasons.push({
      type: CARD_TYPES.PLATFORM_PULL,
      window: windowKey,
      triggered: true,
      reason: `✓ ${platformName}: ${f.topPlatform.count} clicks`,
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
  const { minPeakCount } = THRESHOLDS.PEAK_HOUR;

  if (!f || !f.peakHour) {
    debugReasons.push({
      type: CARD_TYPES.PEAK_HOUR,
      window: '24h',
      triggered: false,
      reason: 'No peak hour data',
    });
    return null;
  }

  // Eligibility: peakHour.count ≥ 10
  if (f.peakHour.count < minPeakCount) {
    debugReasons.push({
      type: CARD_TYPES.PEAK_HOUR,
      window: '24h',
      triggered: false,
      reason: `Peak count ${f.peakHour.count} < ${minPeakCount} required`,
    });
    return null;
  }

  // Don't duplicate with AFTER_SHOW_ENERGY (night hours)
  const nightHours = THRESHOLDS.AFTER_SHOW_ENERGY.nightHours;
  if (nightHours.includes(f.peakHour.hour)) {
    debugReasons.push({
      type: CARD_TYPES.PEAK_HOUR,
      window: '24h',
      triggered: false,
      reason: `Peak hour ${f.peakHour.hour} is night hour (use AFTER_SHOW_ENERGY instead)`,
    });
    return null;
  }

  debugReasons.push({
    type: CARD_TYPES.PEAK_HOUR,
    window: '24h',
    triggered: true,
    reason: `✓ Peak at ${formatHour(f.peakHour.hour)}: ${f.peakHour.count} hits`,
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

/**
 * Compute score for a card based on type-specific rules
 * Returns { score, breakdown } for debug purposes
 */
function computeScore(card, featuresByWindow, debug = false) {
  const f = featuresByWindow[card.window];
  const ctx = card.context || {};
  let score = BASE_SCORES[card.type] || 50;
  const breakdown = { base: score, bonuses: [] };

  switch (card.type) {
    case CARD_TYPES.CITY_CLAIM:
      // +20 if sharePct ≥60, +10 if totalInteractions ≥50, cap 95
      if (ctx.sharePct >= 60) {
        score += 20;
        breakdown.bonuses.push('+20 (sharePct ≥60)');
      }
      if (f && f.totalInteractions >= 50) {
        score += 10;
        breakdown.bonuses.push('+10 (interactions ≥50)');
      }
      score = Math.min(score, 95);
      break;

    case CARD_TYPES.MOMENTUM_SURGE:
      // +20 if ≥100%, +10 if interactions ≥30
      if (ctx.growthPct >= 100) {
        score += 20;
        breakdown.bonuses.push('+20 (growth ≥100%)');
      }
      if (f && f.totalInteractions >= 30) {
        score += 10;
        breakdown.bonuses.push('+10 (interactions ≥30)');
      }
      break;

    case CARD_TYPES.AFTER_SHOW_ENERGY:
      // +15 if ≥50 interactions, +10 if sharesCount >0
      if (ctx.totalInteractions >= 50) {
        score += 15;
        breakdown.bonuses.push('+15 (interactions ≥50)');
      }
      if (f && f.sharesCount > 0) {
        score += 10;
        breakdown.bonuses.push('+10 (has shares)');
      }
      break;

    case CARD_TYPES.PEAK_HOUR:
      // +15 if ≥20 hits, +10 if growthPct >0
      if (ctx.peakHour && ctx.peakHour.count >= 20) {
        score += 15;
        breakdown.bonuses.push('+15 (peak ≥20)');
      }
      if (f && f.growthPct > 0) {
        score += 10;
        breakdown.bonuses.push('+10 (positive growth)');
      }
      break;

    case CARD_TYPES.NEW_CITY_UNLOCKED:
      // +15 if ≥2 new cities, +10 if total cities ≥5
      if (ctx.newCityCount >= 2) {
        score += 15;
        breakdown.bonuses.push('+15 (≥2 new cities)');
      }
      if (f && f.uniqueCities >= 5) {
        score += 10;
        breakdown.bonuses.push('+10 (total cities ≥5)');
      }
      break;

    case CARD_TYPES.RETURNING_FANS:
      // +20 if ≥40%
      if (ctx.returningRate >= 40) {
        score += 20;
        breakdown.bonuses.push('+20 (returning ≥40%)');
      }
      break;

    case CARD_TYPES.SHARE_CHAIN:
      // +10 per share beyond 3, cap 85
      const extraShares = Math.max(0, (ctx.sharesCount || 0) - 3);
      const shareBonus = Math.min(extraShares * 10, 35);
      if (shareBonus > 0) {
        score += shareBonus;
        breakdown.bonuses.push(`+${shareBonus} (${extraShares} extra shares)`);
      }
      score = Math.min(score, 85);
      break;

    case CARD_TYPES.ENGAGED_SESSIONS:
      // +15 if ≥2:30 (150 seconds)
      if (ctx.avgTimeOnPageSec >= 150) {
        score += 15;
        breakdown.bonuses.push('+15 (avg ≥2:30)');
      }
      break;

    case CARD_TYPES.PLATFORM_PULL:
      // +15 if ≥25 clicks
      if (ctx.count >= 25) {
        score += 15;
        breakdown.bonuses.push('+15 (clicks ≥25)');
      }
      break;

    case CARD_TYPES.MILESTONE_DROP:
      // Fixed 90
      score = 90;
      breakdown.base = 90;
      break;
  }

  breakdown.final = Math.max(0, Math.min(100, score));
  
  if (debug) {
    return { score: breakdown.final, breakdown };
  }
  return breakdown.final;
}

/**
 * Build recommended set with strict variety enforcement
 * Rules:
 * - Max 3 cards total
 * - Max 1 per family (geo, growth, engagement, distribution, achievement)
 * - Sort by score DESC
 * - If fewer qualify, return fewer (no padding)
 */
function buildRecommended(scoredCards, maxCount = 3) {
  const recommended = [];
  const familyUsed = {};

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

    // Enforce strict variety: max 1 per family
    if (cardFamily && familyUsed[cardFamily]) {
      continue;
    }

    // Add to recommended
    recommended.push(card);
    if (cardFamily) {
      familyUsed[cardFamily] = true;
    }
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
