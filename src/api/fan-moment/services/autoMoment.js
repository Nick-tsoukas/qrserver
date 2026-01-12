'use strict';

/**
 * Auto-Moment Service
 * Evaluates pulse signals and creates shareable moments when thresholds are met
 */

const { DateTime } = require('luxon');

// Trigger thresholds
const THRESHOLDS = {
  PULSE_SURGE: {
    velocityMultiplier: 2.5, // 2.5x baseline
    minInteractions: 25,
    windowMinutes: 60,
  },
  CITY_HEAT: {
    minCityInteractions: 10,
    minCityShare: 0.40, // 40% of traffic from one city
    windowMinutes: 90,
  },
  MOMENT_MATTERED: {
    velocityMultiplier: 1.5, // Lower threshold fallback
    minInteractions: 15,
    windowMinutes: 60,
  },
};

// Rate limits
const RATE_LIMIT_HOURS = 6;
const MOMENT_EXPIRY_HOURS = 24;

/**
 * Evaluate a single band for auto-moment creation
 * @param {object} strapi - Strapi instance
 * @param {number} bandId - Band ID to evaluate
 * @param {boolean} dryRun - If true, don't create records
 * @returns {object} Evaluation result
 */
async function evaluateBand(strapi, bandId, dryRun = false) {
  const now = DateTime.utc();
  const result = {
    bandId,
    evaluated: true,
    triggered: false,
    momentType: null,
    reason: null,
    context: null,
    created: false,
  };

  try {
    // Get band info
    const band = await strapi.entityService.findOne('api::band.band', bandId, {
      fields: ['id', 'name', 'slug'],
    });

    if (!band) {
      result.reason = 'Band not found';
      return result;
    }

    // Check rate limit - no AUTO moment in last 6 hours
    const rateLimitCutoff = now.minus({ hours: RATE_LIMIT_HOURS }).toISO();
    const recentAutoMoments = await strapi.db.query('api::fan-moment.fan-moment').findMany({
      where: {
        band: bandId,
        actionType: 'AUTO',
        createdAt: { $gte: rateLimitCutoff },
      },
      limit: 1,
    });

    if (recentAutoMoments.length > 0) {
      result.reason = 'Rate limited - AUTO moment created within last 6 hours';
      return result;
    }

    // Check if there's already an active AUTO moment
    const activeAutoMoments = await strapi.db.query('api::fan-moment.fan-moment').findMany({
      where: {
        band: bandId,
        actionType: 'AUTO',
        expiresAt: { $gt: now.toISO() },
      },
      limit: 1,
    });

    if (activeAutoMoments.length > 0) {
      result.reason = 'Active AUTO moment already exists';
      return result;
    }

    // Fetch interaction data for evaluation windows
    const pulseData = await fetchPulseData(strapi, bandId, now);

    if (!pulseData) {
      result.reason = 'No pulse data available';
      return result;
    }

    // Evaluate triggers in priority order: CITY_HEAT > PULSE_SURGE > MOMENT_MATTERED
    let trigger = null;

    // Try CITY_HEAT first (if city data available)
    if (pulseData.cityBreakdown && pulseData.cityBreakdown.length > 0) {
      const cityHeat = evaluateCityHeat(pulseData);
      if (cityHeat.triggered) {
        trigger = { type: 'CITY_HEAT', ...cityHeat };
      }
    }

    // Try PULSE_SURGE if no CITY_HEAT
    if (!trigger) {
      const pulseSurge = evaluatePulseSurge(pulseData);
      if (pulseSurge.triggered) {
        trigger = { type: 'PULSE_SURGE', ...pulseSurge };
      }
    }

    // Try MOMENT_MATTERED as fallback
    if (!trigger) {
      const momentMattered = evaluateMomentMattered(pulseData);
      if (momentMattered.triggered) {
        trigger = { type: 'MOMENT_MATTERED', ...momentMattered };
      }
    }

    if (!trigger) {
      result.reason = 'No trigger conditions met';
      result.context = {
        recentInteractions: pulseData.recentInteractions,
        baselineInteractions: pulseData.baselineInteractions,
        velocity: pulseData.velocity,
      };
      return result;
    }

    // Build moment data
    const momentData = buildMomentData(band, trigger, pulseData, now);
    result.triggered = true;
    result.momentType = trigger.type;
    result.context = momentData.context;

    if (!dryRun) {
      // Create the fan-moment record with rich content
      await strapi.db.query('api::fan-moment.fan-moment').create({
        data: {
          band: bandId,
          visitorId: 'system',
          sessionId: null,
          momentType: trigger.type,
          actionType: 'AUTO',
          expiresAt: momentData.expiresAt,
          context: momentData.context,
          triggerReason: momentData.triggerReason,
          shareTitle: momentData.shareTitle,
          shareText: momentData.shareText,
          shareSubtitle: momentData.shareSubtitle,
          shareEmoji: momentData.shareEmoji,
          shareCallToAction: momentData.shareCallToAction,
        },
      });
      result.created = true;
    }

    return result;
  } catch (err) {
    strapi.log.error(`[autoMoment.evaluateBand] Error for band ${bandId}:`, err);
    result.reason = `Error: ${err.message}`;
    return result;
  }
}

/**
 * Fetch pulse data for a band
 */
async function fetchPulseData(strapi, bandId, now) {
  const uidPV = 'api::band-page-view.band-page-view';
  const uidLC = 'api::link-click.link-click';
  const uidMP = 'api::media-play.media-play';

  // Recent window (60 minutes)
  const recentFrom = now.minus({ minutes: 60 }).toISO();
  const recentTo = now.toISO();

  // Baseline window (24 hours ago, same 60-minute window)
  const baselineFrom = now.minus({ hours: 24, minutes: 60 }).toISO();
  const baselineTo = now.minus({ hours: 24 }).toISO();

  // Extended window for city heat (90 minutes)
  const extendedFrom = now.minus({ minutes: 90 }).toISO();

  try {
    // Fetch recent interactions
    const [recentPV, recentLC, recentMP] = await Promise.all([
      strapi.db.query(uidPV).count({
        where: { band: bandId, timestamp: { $gte: recentFrom, $lte: recentTo } },
      }),
      strapi.db.query(uidLC).count({
        where: { band: bandId, timestamp: { $gte: recentFrom, $lte: recentTo } },
      }),
      strapi.db.query(uidMP).count({
        where: { band: bandId, timestamp: { $gte: recentFrom, $lte: recentTo } },
      }),
    ]);

    const recentInteractions = recentPV + recentLC + recentMP;

    // Fetch baseline interactions (same window 24h ago)
    const [baselinePV, baselineLC, baselineMP] = await Promise.all([
      strapi.db.query(uidPV).count({
        where: { band: bandId, timestamp: { $gte: baselineFrom, $lte: baselineTo } },
      }),
      strapi.db.query(uidLC).count({
        where: { band: bandId, timestamp: { $gte: baselineFrom, $lte: baselineTo } },
      }),
      strapi.db.query(uidMP).count({
        where: { band: bandId, timestamp: { $gte: baselineFrom, $lte: baselineTo } },
      }),
    ]);

    const baselineInteractions = baselinePV + baselineLC + baselineMP;

    // Calculate velocity
    const velocity = baselineInteractions > 0 
      ? recentInteractions / baselineInteractions 
      : recentInteractions > 0 ? 10 : 0; // 10x if baseline is 0 but recent has activity

    // Fetch city breakdown for extended window
    const cityRows = await strapi.db.query(uidPV).findMany({
      where: { band: bandId, timestamp: { $gte: extendedFrom, $lte: recentTo } },
      select: ['city'],
    });

    const cityMap = {};
    cityRows.forEach((r) => {
      const city = r.city || 'Unknown';
      cityMap[city] = (cityMap[city] || 0) + 1;
    });

    const cityBreakdown = Object.entries(cityMap)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);

    const totalCityInteractions = cityRows.length;

    return {
      recentInteractions,
      baselineInteractions,
      velocity,
      cityBreakdown,
      totalCityInteractions,
      windowMinutes: 60,
    };
  } catch (err) {
    strapi.log.error(`[autoMoment.fetchPulseData] Error:`, err);
    return null;
  }
}

/**
 * Evaluate PULSE_SURGE trigger
 */
function evaluatePulseSurge(pulseData) {
  const { velocity, recentInteractions } = pulseData;
  const { velocityMultiplier, minInteractions } = THRESHOLDS.PULSE_SURGE;

  const triggered = velocity >= velocityMultiplier && recentInteractions >= minInteractions;

  return {
    triggered,
    velocity,
    recentInteractions,
    threshold: { velocityMultiplier, minInteractions },
  };
}

/**
 * Evaluate CITY_HEAT trigger
 */
function evaluateCityHeat(pulseData) {
  const { cityBreakdown, totalCityInteractions } = pulseData;
  const { minCityInteractions, minCityShare } = THRESHOLDS.CITY_HEAT;

  if (!cityBreakdown || cityBreakdown.length === 0 || totalCityInteractions === 0) {
    return { triggered: false };
  }

  const topCity = cityBreakdown[0];
  const cityShare = topCity.count / totalCityInteractions;

  const triggered = topCity.count >= minCityInteractions && cityShare >= minCityShare;

  return {
    triggered,
    cityName: topCity.city,
    cityInteractions: topCity.count,
    cityShare,
    threshold: { minCityInteractions, minCityShare },
  };
}

/**
 * Evaluate MOMENT_MATTERED trigger (fallback)
 */
function evaluateMomentMattered(pulseData) {
  const { velocity, recentInteractions } = pulseData;
  const { velocityMultiplier, minInteractions } = THRESHOLDS.MOMENT_MATTERED;

  const triggered = velocity >= velocityMultiplier && recentInteractions >= minInteractions;

  return {
    triggered,
    velocity,
    recentInteractions,
    threshold: { velocityMultiplier, minInteractions },
  };
}

/**
 * Build moment data for creation using templates
 */
function buildMomentData(band, trigger, pulseData, now) {
  const momentTemplates = require('./momentTemplates');
  const expiresAt = now.plus({ hours: MOMENT_EXPIRY_HOURS }).toISO();
  const bandName = band.name || 'This Artist';

  // Build template context with all available data
  const templateContext = {
    bandName,
    bandSlug: band.slug,
    velocity: Math.round(pulseData.velocity * 100) / 100,
    recentInteractions: pulseData.recentInteractions,
    baselineInteractions: pulseData.baselineInteractions,
    windowMinutes: pulseData.windowMinutes,
  };

  // Add city-specific context for CITY_HEAT
  if (trigger.type === 'CITY_HEAT') {
    templateContext.cityName = trigger.cityName;
    templateContext.cityInteractions = trigger.cityInteractions;
    templateContext.cityShare = Math.round(trigger.cityShare * 100) / 100;
  }

  // Generate rich share content using templates
  const shareContent = momentTemplates.generateMomentContent(trigger.type, 'AUTO', templateContext);
  const triggerReason = momentTemplates.getTriggerReason(trigger.type, 'AUTO', templateContext);

  const context = {
    kind: 'auto',
    ...templateContext,
    momentType: trigger.type,
    triggeredAt: now.toISO(),
  };

  return {
    expiresAt,
    shareTitle: shareContent.shareTitle,
    shareText: shareContent.shareText,
    shareSubtitle: shareContent.shareSubtitle,
    shareEmoji: shareContent.shareEmoji,
    shareCallToAction: shareContent.shareCallToAction,
    triggerReason,
    context,
  };
}

/**
 * Evaluate all bands with recent activity
 * @param {object} strapi - Strapi instance
 * @param {boolean} dryRun - If true, don't create records
 * @returns {object} Evaluation results
 */
async function evaluateAllBands(strapi, dryRun = false) {
  const now = DateTime.utc();
  const activityCutoff = now.minus({ hours: 24 }).toISO();

  try {
    // Find bands with page views in last 24 hours
    const activeBandRows = await strapi.db.query('api::band-page-view.band-page-view').findMany({
      where: { timestamp: { $gte: activityCutoff } },
      select: ['id'],
      populate: { band: { select: ['id'] } },
      limit: 10000,
    });

    // Get unique band IDs (handle both direct ID and populated object)
    const bandIds = [...new Set(
      activeBandRows
        .map((r) => {
          if (typeof r.band === 'number') return r.band;
          if (r.band?.id) return r.band.id;
          return null;
        })
        .filter(Boolean)
    )];

    const results = {
      evaluated: 0,
      created: 0,
      createdMoments: [],
      errors: [],
    };

    for (const bandId of bandIds) {
      const evalResult = await evaluateBand(strapi, bandId, dryRun);
      results.evaluated++;

      if (evalResult.created) {
        results.created++;
        results.createdMoments.push({
          bandId: evalResult.bandId,
          momentType: evalResult.momentType,
          context: evalResult.context,
        });
      }

      if (evalResult.reason && evalResult.reason.startsWith('Error:')) {
        results.errors.push({ bandId, error: evalResult.reason });
      }
    }

    return results;
  } catch (err) {
    strapi.log.error('[autoMoment.evaluateAllBands] Error:', err);
    throw err;
  }
}

/**
 * Get active AUTO moment for a band
 */
async function getActiveAutoMoment(strapi, bandId) {
  const now = DateTime.utc().toISO();

  const moments = await strapi.db.query('api::fan-moment.fan-moment').findMany({
    where: {
      band: bandId,
      actionType: 'AUTO',
      expiresAt: { $gt: now },
    },
    orderBy: { createdAt: 'desc' },
    limit: 1,
    populate: ['band'],
  });

  if (moments.length === 0) return null;

  const moment = moments[0];
  return {
    id: String(moment.id),
    bandId: moment.band?.id || bandId,
    momentType: moment.momentType,
    actionType: moment.actionType,
    createdAt: moment.createdAt,
    expiresAt: moment.expiresAt,
    triggerReason: moment.triggerReason || null,
    share: {
      title: moment.shareTitle,
      subtitle: moment.shareSubtitle || null,
      text: moment.shareText,
      emoji: moment.shareEmoji || '✨',
      callToAction: moment.shareCallToAction || 'Check them out',
    },
    context: moment.context || {},
  };
}

module.exports = {
  evaluateBand,
  evaluateAllBands,
  getActiveAutoMoment,
  THRESHOLDS,
  RATE_LIMIT_HOURS,
  MOMENT_EXPIRY_HOURS,
};
