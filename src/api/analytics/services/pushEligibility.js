'use strict';

/**
 * Push Eligibility Service for MBQ Pulse
 * 
 * CORE RULE: Push notifications are ONLY triggered when a band's Pulse
 * transitions INTO surging (previousMomentumState !== "surging" AND currentMomentumState === "surging")
 */

const { DateTime } = require('luxon');

// ============================================================
// ACTIVITY COMPUTATION
// ============================================================

/**
 * Compute total activity from signals
 */
function computeActivityTotals(signals) {
  const { totals = {} } = signals;
  return (
    (totals.views || 0) +
    (totals.qrScans || 0) +
    (totals.linkClicks || 0) +
    (totals.mediaPlays || 0) +
    (totals.follows || 0) +
    (totals.paymentsCount || 0)
  );
}

/**
 * Count days with activity from daily series
 */
function countDaysWithActivity(signals) {
  const { dailySeries = [] } = signals;
  return dailySeries.filter(day => {
    const total = (day.views || 0) + (day.qrScans || 0) + (day.linkClicks || 0) + 
                  (day.mediaPlays || 0) + (day.follows || 0);
    return total > 0;
  }).length;
}

/**
 * Compute growth metrics between current and previous periods
 */
function computeGrowth(currentSignals, previousSignals) {
  const currentTotal = computeActivityTotals(currentSignals);
  const previousTotal = computeActivityTotals(previousSignals);
  
  const absoluteIncrease = currentTotal - previousTotal;
  const growthPct = previousTotal > 0 
    ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
    : (currentTotal > 0 ? 100 : 0);
  
  return { currentTotal, previousTotal, absoluteIncrease, growthPct };
}

// ============================================================
// CONFIDENCE CHECKS
// ============================================================

/**
 * Check if current hour is high engagement (11-14 or 18-22)
 */
function isHighEngagementHour(now, timezone = 'UTC') {
  const dt = DateTime.fromJSDate(now).setZone(timezone);
  const hour = dt.hour;
  return (hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 22);
}

/**
 * Calculate share percentages for confidence checks
 */
function calculateShares(signals) {
  const { totals = {}, sources = {}, geo = {}, devices = {} } = signals;
  const totalViews = totals.views || 1;
  
  // Top city share
  const topCity = geo.topCities?.[0];
  const topCityShare = topCity ? Math.round((topCity.count / totalViews) * 100) : 0;
  
  // Top source share
  const topSource = sources.topSources?.[0];
  const topSourceShare = topSource ? Math.round((topSource.count / totalViews) * 100) : 0;
  
  // Top device share
  const deviceCounts = {
    mobile: devices.mobile || 0,
    desktop: devices.desktop || 0,
    tablet: devices.tablet || 0,
  };
  const totalDevices = Object.values(deviceCounts).reduce((a, b) => a + b, 0) || 1;
  const topDevice = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])[0];
  const topDeviceShare = Math.round((topDevice[1] / totalDevices) * 100);
  const topDeviceName = topDevice[0];
  
  return {
    topCity: topCity?.name || null,
    topCityShare,
    topSource: topSource?.name || null,
    topSourceShare,
    topDevice: topDeviceName,
    topDeviceShare,
  };
}

/**
 * Check if at least one confidence threshold is met
 */
function hasConfidenceSignal(shares, now, timezone) {
  // At least ONE of these must be true
  if (shares.topCityShare >= 35) return { passed: true, reason: 'topCityShare', value: shares.topCityShare };
  if (shares.topSourceShare >= 40) return { passed: true, reason: 'topSourceShare', value: shares.topSourceShare };
  if (shares.topDeviceShare >= 60) return { passed: true, reason: 'topDeviceShare', value: shares.topDeviceShare };
  if (isHighEngagementHour(now, timezone)) return { passed: true, reason: 'highEngagementHour', value: true };
  
  return { passed: false, reason: null, value: null };
}

// ============================================================
// PUSH COPY GENERATION
// ============================================================

/**
 * Build surge notification copy
 * Tone: calm authority. Never hype. Never guilt.
 * Allowed emoji: ONLY 🚀 and ONLY for surging.
 */
function buildSurgeCopy({ pulseScore, topCity, topDeviceShare, topDevice, topSource }) {
  const title = '🚀 You\'re surging';
  
  // Specific signal priority: City > Device > Source > Fallback
  let specificSignal;
  if (topCity) {
    specificSignal = `Fans are active in ${topCity} right now.`;
  } else if (topDeviceShare && topDevice && topDeviceShare >= 60) {
    specificSignal = `${topDeviceShare}% of traffic is ${topDevice} right now.`;
  } else if (topSource) {
    specificSignal = `Momentum spike from ${topSource} traffic.`;
  } else {
    specificSignal = 'Momentum spiked in the last 24 hours.';
  }
  
  const message = `🚀 You're surging. Pulse jumped to ${pulseScore}. ${specificSignal}`;
  
  return { title, message };
}

// ============================================================
// MAIN ELIGIBILITY EVALUATION
// ============================================================

/**
 * Evaluate whether a surge push notification should be sent
 * Returns detailed eligibility result with reasons
 */
function evaluateSurgePush({ user, band, currentPulse, currentSignals, prevSnapshot, now }) {
  const reasons = [];
  const failedChecks = [];
  
  // Initialize result
  const result = {
    eligible: false,
    wouldSend: false,
    reasons: [],
    notification: null,
    debugInfo: {},
  };
  
  const nowDt = DateTime.fromJSDate(now);
  
  // ============================================================
  // CORE RULE: Must be transitioning INTO surging
  // ============================================================
  const prevMomentum = prevSnapshot?.momentumState || 'steady';
  const currentMomentum = currentPulse?.momentumState;
  
  if (currentMomentum !== 'surging') {
    failedChecks.push(`Current momentum is "${currentMomentum}", not "surging"`);
    result.reasons = failedChecks;
    result.debugInfo = { prevMomentum, currentMomentum };
    return result;
  }
  
  if (prevMomentum === 'surging') {
    failedChecks.push('Already in surging state (no transition)');
    result.reasons = failedChecks;
    result.debugInfo = { prevMomentum, currentMomentum };
    return result;
  }
  
  reasons.push(`Momentum transition: ${prevMomentum} → surging`);
  
  // ============================================================
  // USER-LEVEL GATES
  // ============================================================
  
  // User has exactly ONE band (for regular users)
  // Note: Special team accounts may have multiple, we use first band
  if (!user) {
    failedChecks.push('No user associated with band');
    result.reasons = failedChecks;
    return result;
  }
  
  // pushOptIn must be true
  if (!user.pushOptIn) {
    failedChecks.push('User has not opted in to push notifications');
    result.reasons = [...reasons, ...failedChecks];
    result.debugInfo = { pushOptIn: user.pushOptIn };
    return result;
  }
  reasons.push('User has opted in to push notifications');
  
  // Account age >= 7 days
  const userCreatedAt = DateTime.fromISO(user.createdAt);
  const accountAgeDays = Math.floor(nowDt.diff(userCreatedAt, 'days').days);
  if (accountAgeDays < 7) {
    failedChecks.push(`Account age is ${accountAgeDays} days (minimum 7 required)`);
    result.reasons = [...reasons, ...failedChecks];
    result.debugInfo = { accountAgeDays };
    return result;
  }
  reasons.push(`Account age: ${accountAgeDays} days`);
  
  // ============================================================
  // BAND DATA SUFFICIENCY
  // ============================================================
  
  const totalActivity = computeActivityTotals(currentSignals);
  if (totalActivity < 30) {
    failedChecks.push(`Total activity is ${totalActivity} (minimum 30 required)`);
    result.reasons = [...reasons, ...failedChecks];
    result.debugInfo = { totalActivity };
    return result;
  }
  reasons.push(`Total activity: ${totalActivity}`);
  
  const daysWithActivity = countDaysWithActivity(currentSignals);
  if (daysWithActivity < 3) {
    failedChecks.push(`Days with activity is ${daysWithActivity} (minimum 3 required)`);
    result.reasons = [...reasons, ...failedChecks];
    result.debugInfo = { daysWithActivity };
    return result;
  }
  reasons.push(`Days with activity: ${daysWithActivity}`);
  
  // ============================================================
  // SURGE THRESHOLDS
  // ============================================================
  
  const growthPct = currentPulse?.drivers?.growthPct || 0;
  if (growthPct < 50) {
    failedChecks.push(`Growth is ${growthPct}% (minimum 50% required)`);
    result.reasons = [...reasons, ...failedChecks];
    result.debugInfo = { growthPct };
    return result;
  }
  reasons.push(`Growth: ${growthPct}%`);
  
  // Calculate absolute increase
  const prevTotalActivity = prevSnapshot?.totalActivity || 0;
  const absoluteIncrease = totalActivity - prevTotalActivity;
  if (absoluteIncrease < 20) {
    failedChecks.push(`Absolute increase is ${absoluteIncrease} (minimum 20 required)`);
    result.reasons = [...reasons, ...failedChecks];
    result.debugInfo = { absoluteIncrease, prevTotalActivity, totalActivity };
    return result;
  }
  reasons.push(`Absolute increase: ${absoluteIncrease}`);
  
  // ============================================================
  // CONFIDENCE CHECKS (at least ONE required)
  // ============================================================
  
  const shares = calculateShares(currentSignals);
  const bandTimezone = band?.timezone || 'UTC';
  const confidence = hasConfidenceSignal(shares, now, bandTimezone);
  
  if (!confidence.passed) {
    failedChecks.push('No confidence signal met (topCityShare >= 35%, topSourceShare >= 40%, topDeviceShare >= 60%, or high engagement hour)');
    result.reasons = [...reasons, ...failedChecks];
    result.debugInfo = { shares, bandTimezone };
    return result;
  }
  reasons.push(`Confidence signal: ${confidence.reason} = ${confidence.value}`);
  
  // ============================================================
  // COOLDOWN + DEBOUNCE
  // ============================================================
  
  // Hard cooldown: 14 days since last surge push
  if (prevSnapshot?.lastSurgePushAt) {
    const lastPushDt = DateTime.fromISO(prevSnapshot.lastSurgePushAt);
    const daysSinceLastPush = Math.floor(nowDt.diff(lastPushDt, 'days').days);
    if (daysSinceLastPush < 14) {
      failedChecks.push(`Last surge push was ${daysSinceLastPush} days ago (14 day cooldown)`);
      result.reasons = [...reasons, ...failedChecks];
      result.debugInfo = { daysSinceLastPush, lastSurgePushAt: prevSnapshot.lastSurgePushAt };
      return result;
    }
    reasons.push(`Days since last push: ${daysSinceLastPush}`);
  }
  
  // Debounce: ignore if momentum changed < 24 hours ago
  if (prevSnapshot?.lastMomentumChangeAt) {
    const lastChangeDt = DateTime.fromISO(prevSnapshot.lastMomentumChangeAt);
    const hoursSinceChange = nowDt.diff(lastChangeDt, 'hours').hours;
    if (hoursSinceChange < 24) {
      failedChecks.push(`Momentum changed ${Math.round(hoursSinceChange)} hours ago (24 hour debounce)`);
      result.reasons = [...reasons, ...failedChecks];
      result.debugInfo = { hoursSinceChange };
      return result;
    }
  }
  
  // One push per surge cycle check
  if (prevSnapshot?.surgePushSent && prevMomentum !== 'steady' && prevMomentum !== 'cooling') {
    failedChecks.push('Push already sent for this surge cycle (must drop below steady first)');
    result.reasons = [...reasons, ...failedChecks];
    return result;
  }
  
  // ============================================================
  // ALL CHECKS PASSED - BUILD NOTIFICATION
  // ============================================================
  
  const { title, message } = buildSurgeCopy({
    pulseScore: currentPulse.pulseScore,
    topCity: shares.topCity,
    topDeviceShare: shares.topDeviceShare,
    topDevice: shares.topDevice,
    topSource: shares.topSource,
  });
  
  result.eligible = true;
  result.wouldSend = true;
  result.reasons = reasons;
  result.notification = {
    title,
    message,
    deepLink: '/dashboard',
    meta: {
      pulseScore: currentPulse.pulseScore,
      growthPct,
      absoluteIncrease,
      totalActivity,
      topCity: shares.topCity,
      topCityShare: shares.topCityShare,
      topSource: shares.topSource,
      topSourceShare: shares.topSourceShare,
      topDevice: shares.topDevice,
      topDeviceShare: shares.topDeviceShare,
      prevMomentum,
      currentMomentum,
      confidenceSignal: confidence.reason,
    },
  };
  result.debugInfo = {
    shares,
    accountAgeDays,
    totalActivity,
    daysWithActivity,
    growthPct,
    absoluteIncrease,
  };
  
  return result;
}

// ============================================================
// NOTIFICATION CREATION HELPERS
// ============================================================

/**
 * Create notification records in database
 * Creates both in_app and push_candidate channels
 */
async function createSurgeNotifications(strapi, { user, band, notification }) {
  const baseData = {
    user: user.id,
    band: band.id,
    type: 'pulse_surge',
    title: notification.title,
    message: notification.message,
    deepLink: notification.deepLink,
    severity: 'info',
    meta: notification.meta,
  };
  
  // Check for duplicate notifications in last 24 hours
  const oneDayAgo = DateTime.now().minus({ hours: 24 }).toISO();
  const existing = await strapi.entityService.findMany('api::notification.notification', {
    filters: {
      user: user.id,
      band: band.id,
      type: 'pulse_surge',
      createdAt: { $gte: oneDayAgo },
    },
    limit: 1,
  });
  
  if (existing.length > 0) {
    return { created: false, reason: 'Duplicate notification within 24 hours' };
  }
  
  // Create in_app notification
  const inAppNotification = await strapi.entityService.create('api::notification.notification', {
    data: { ...baseData, channel: 'in_app' },
  });
  
  // Create push_candidate notification (for future APNS/FCM integration)
  const pushCandidate = await strapi.entityService.create('api::notification.notification', {
    data: { ...baseData, channel: 'push_candidate' },
  });
  
  return {
    created: true,
    inAppNotification,
    pushCandidate,
  };
}

/**
 * Update pulse snapshot with surge push tracking
 */
async function updateSnapshotAfterPush(strapi, snapshotId, now) {
  return strapi.entityService.update('api::pulse-snapshot.pulse-snapshot', snapshotId, {
    data: {
      surgePushSent: true,
      lastSurgePushAt: now.toISO(),
    },
  });
}

module.exports = {
  computeActivityTotals,
  countDaysWithActivity,
  computeGrowth,
  isHighEngagementHour,
  calculateShares,
  hasConfidenceSignal,
  buildSurgeCopy,
  evaluateSurgePush,
  createSurgeNotifications,
  updateSnapshotAfterPush,
};
