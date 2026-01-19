'use strict';

/**
 * Muse Insights Engine ELITE v2
 * 
 * Generates high-quality, actionable insights with:
 * - Consistent elite shape (key, category, title, summary, severity, confidence, window, why, metrics, recommendedActions)
 * - Recomputes on EVERY request (no caching)
 * - Improved thresholds to reduce noise - insights must be EARNED
 * - Graceful degradation when data is missing
 * - Max 7 insights, ranked by impact
 */

const SEVERITY = {
  CRITICAL: 'critical',  // Needs immediate attention
  WARNING: 'warning',    // Should address soon
  GOOD: 'good',          // Positive signal
  INFO: 'info',          // Neutral information
};

const CATEGORY = {
  GROWTH: 'growth',
  ENGAGEMENT: 'engagement',
  CITIES: 'cities',
  PLATFORMS: 'platforms',
  SHARE: 'share',
  TOUR: 'tour',
  AUDIENCE: 'audience',
  SOURCE: 'source',
};

// Severity weights for ranking
const SEVERITY_WEIGHT = {
  critical: 4,
  warning: 3,
  good: 2,
  info: 1,
};

/**
 * Create a standardized elite insight object
 */
function createInsight({
  key,
  category = CATEGORY.GROWTH,
  title,
  summary,
  severity = SEVERITY.INFO,
  confidence = 50,
  why = [],
  metrics = {},
  recommendedActions = [],
  window = '7d',
}) {
  // Calculate impact score for ranking
  const impactScore = (SEVERITY_WEIGHT[severity] || 1) * (confidence / 100);
  
  return {
    key,
    category,
    title,
    summary,
    severity,
    confidence: Math.min(100, Math.max(0, Math.round(confidence))),
    window,
    why: Array.isArray(why) ? why.filter(Boolean) : [why].filter(Boolean),
    metrics,
    recommendedActions: recommendedActions.map(a => ({
      label: a.label,
      route: a.route || null,
      type: a.type || 'secondary',
    })),
    _impactScore: impactScore, // Internal for ranking
  };
}

/**
 * Calculate percentage change safely
 */
function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Sum values from array using picker function
 */
function sum(arr, pick) {
  return (arr || []).reduce((a, x) => a + (pick(x) || 0), 0);
}

/**
 * INSIGHT: Traffic Momentum
 * Compares current period to previous period
 * ELITE: Requires baseline volume >= 50 views to avoid noise
 */
function analyzeTrafficMomentum({ last7, prev7, today, yesterday, todayPartial }) {
  const insights = [];
  
  const pv7 = sum(last7, r => r.pageViews);
  const pvPrev7 = sum(prev7, r => r.pageViews);
  const pvToday = (today?.pageViews || 0) + (todayPartial?.pageViews || 0);
  const pvYesterday = yesterday?.pageViews || 0;
  
  // ELITE: Require baseline volume >= 50 views to reduce noise
  if (pv7 < 50 && pvPrev7 < 50) return insights;
  
  const weekDelta = pctChange(pv7, pvPrev7);
  
  // Only generate insight if change is significant (>15%)
  if (Math.abs(weekDelta) >= 15) {
    const isGrowth = weekDelta > 0;
    const severity = isGrowth 
      ? (weekDelta >= 50 ? SEVERITY.GOOD : SEVERITY.INFO)
      : (weekDelta <= -30 ? SEVERITY.WARNING : SEVERITY.INFO);
    
    // Higher confidence with more volume
    const volumeBonus = Math.min(25, pv7 / 10);
    const confidence = Math.min(95, 50 + Math.abs(weekDelta) / 2 + volumeBonus);
    
    insights.push(createInsight({
      key: 'traffic_momentum_week',
      category: CATEGORY.GROWTH,
      title: isGrowth ? 'Traffic Growing' : 'Traffic Declining',
      summary: isGrowth 
        ? `Your page traffic is up ${weekDelta}% this week compared to last week.`
        : `Your page traffic is down ${Math.abs(weekDelta)}% this week compared to last week.`,
      severity,
      confidence,
      why: [
        `This week: ${pv7} page views`,
        `Last week: ${pvPrev7} page views`,
        `Change: ${weekDelta > 0 ? '+' : ''}${weekDelta}%`,
      ],
      metrics: { pv7, pvPrev7, weekDelta, pvToday },
      recommendedActions: isGrowth ? [
        { label: 'Capitalize with a post', type: 'primary' },
        { label: 'Check traffic sources', route: '/analytics/{bandId}', type: 'secondary' },
      ] : [
        { label: 'Review traffic sources', route: '/analytics/{bandId}', type: 'primary' },
        { label: 'Share your link', type: 'secondary' },
      ],
      window: '7d',
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Engagement Quality
 * Measures how well visitors are engaging with content
 * ELITE: Uses 7d smoothing to avoid single-day noise
 */
function analyzeEngagement({ last7, today, todayPartial }) {
  const insights = [];
  
  const pv7 = sum(last7, r => r.pageViews);
  const clicks7 = sum(last7, r => r.linkClicks);
  const songs7 = sum(last7, r => r.songPlays);
  const videos7 = sum(last7, r => r.videoPlays);
  
  // ELITE: Require minimum 30 views for engagement insight
  if (pv7 < 30) return insights;
  
  const totalEngagements = clicks7 + songs7 + videos7;
  const engagementRate = Math.round((totalEngagements / pv7) * 100);
  
  // High engagement (>40%)
  if (engagementRate >= 40) {
    insights.push(createInsight({
      key: 'engagement_high',
      category: CATEGORY.ENGAGEMENT,
      title: 'Strong Engagement',
      summary: `${engagementRate}% of visitors are actively engaging with your content.`,
      severity: SEVERITY.GOOD,
      confidence: Math.min(90, 60 + pv7 / 10),
      why: [
        `${clicks7} link clicks`,
        `${songs7} song plays`,
        `${videos7} video plays`,
        `${pv7} total page views`,
      ],
      metrics: { engagementRate, clicks7, songs7, videos7, pv7 },
      recommendedActions: [
        { label: 'Keep momentum going', type: 'secondary' },
      ],
      window: '7d',
    }));
  }
  // Low engagement with decent traffic (warning)
  else if (engagementRate < 15 && pv7 >= 50) {
    insights.push(createInsight({
      key: 'engagement_low',
      category: CATEGORY.ENGAGEMENT,
      title: 'Engagement Opportunity',
      summary: `Only ${engagementRate}% of visitors are engaging. Consider refreshing your featured content.`,
      severity: SEVERITY.WARNING,
      confidence: Math.min(85, 55 + pv7 / 20),
      why: [
        `${pv7} visitors but only ${totalEngagements} engagements`,
        'Visitors may not be finding what they\'re looking for',
        'Featured content might need updating',
      ],
      metrics: { engagementRate, totalEngagements, pv7 },
      recommendedActions: [
        { label: 'Update featured song', route: '/edit/{bandId}', type: 'primary' },
        { label: 'Add a video', route: '/edit/{bandId}', type: 'secondary' },
      ],
      window: '7d',
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: City Spike Detection
 * Identifies when a city suddenly becomes hot
 * ELITE: Ignores city="Unknown", requires >= 10 views and meaningful delta
 */
function analyzeCitySpike({ last7, prev7, today, todayPartial }) {
  const insights = [];
  
  // Aggregate city data
  const cityMap7 = {};
  const cityMapPrev7 = {};
  
  for (const row of (last7 || [])) {
    for (const [city, count] of (row.topCities || [])) {
      // ELITE: Ignore "Unknown" cities
      if (city === 'Unknown' || city === 'unknown' || !city) continue;
      cityMap7[city] = (cityMap7[city] || 0) + count;
    }
  }
  
  for (const row of (prev7 || [])) {
    for (const [city, count] of (row.topCities || [])) {
      if (city === 'Unknown' || city === 'unknown' || !city) continue;
      cityMapPrev7[city] = (cityMapPrev7[city] || 0) + count;
    }
  }
  
  // Find cities with significant growth
  for (const [city, count] of Object.entries(cityMap7)) {
    // ELITE: Require >= 10 views minimum
    if (count < 10) continue;
    
    const prevCount = cityMapPrev7[city] || 0;
    const growth = pctChange(count, prevCount);
    
    // City spike: >100% growth or new city with 10+ views
    if (growth >= 100 || (prevCount === 0 && count >= 10)) {
      const isNew = prevCount === 0;
      
      insights.push(createInsight({
        key: `city_spike_${city.toLowerCase().replace(/\s+/g, '_')}`,
        category: CATEGORY.CITIES,
        title: isNew ? `New City: ${city}` : `${city} is Heating Up`,
        summary: isNew 
          ? `${city} just appeared on your radar with ${count} views this week.`
          : `Traffic from ${city} is up ${growth}% this week.`,
        severity: SEVERITY.GOOD,
        confidence: Math.min(85, 50 + count / 2),
        why: [
          `This week: ${count} views from ${city}`,
          isNew ? 'First time seeing activity from this city' : `Last week: ${prevCount} views`,
        ],
        metrics: { city, count, prevCount, growth },
        recommendedActions: [
          { label: 'Target this city', type: 'primary' },
          { label: 'Check for shows nearby', route: '/events', type: 'secondary' },
        ],
        window: '7d',
      }));
      
      // Only report top city spike
      break;
    }
  }
  
  return insights;
}

/**
 * INSIGHT: Platform Pull
 * Identifies which platform is getting the most attention
 * ELITE: Requires >= 10 clicks
 */
function analyzePlatformPull({ last7 }) {
  const insights = [];
  
  const platformMap = {};
  for (const row of (last7 || [])) {
    for (const [platform, count] of (row.platforms || [])) {
      platformMap[platform] = (platformMap[platform] || 0) + count;
    }
  }
  
  const sorted = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return insights;
  
  const [topPlatform, topCount] = sorted[0];
  const totalClicks = sorted.reduce((s, [, c]) => s + c, 0);
  
  // ELITE: Require >= 10 clicks
  if (totalClicks < 10) return insights;
  
  const share = Math.round((topCount / totalClicks) * 100);
  
  // Only report if one platform dominates (>50%)
  if (share >= 50) {
    const platformName = topPlatform.charAt(0).toUpperCase() + topPlatform.slice(1);
    
    insights.push(createInsight({
      key: 'platform_pull',
      category: CATEGORY.PLATFORMS,
      title: `${platformName} Leading`,
      summary: `${share}% of your link clicks go to ${platformName}. Your fans know where they want to go.`,
      severity: SEVERITY.INFO,
      confidence: Math.min(90, 60 + totalClicks / 5),
      why: [
        `${topCount} clicks to ${platformName}`,
        `${totalClicks} total link clicks`,
        `${share}% share`,
      ],
      metrics: { topPlatform, topCount, totalClicks, share },
      recommendedActions: [
        { label: `Update ${platformName} profile`, type: 'primary' },
        { label: 'Feature this link', route: '/edit/{bandId}', type: 'secondary' },
      ],
      window: '7d',
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Share Chain Detection
 * Identifies when content is being shared
 * ELITE: Requires >= 5 shares for 7d window
 */
function analyzeShareChain({ shareData, last7 }) {
  const insights = [];
  
  const shares7 = shareData?.shares7 || sum(last7, r => r.shares || 0);
  const sharesPrev7 = shareData?.sharesPrev7 || 0;
  
  // ELITE: Require >= 5 shares
  if (shares7 < 5) return insights;
  
  const growth = pctChange(shares7, sharesPrev7);
  
  insights.push(createInsight({
    key: 'share_chain',
    category: CATEGORY.SHARE,
    title: 'Fans Are Sharing',
    summary: `Your content was shared ${shares7} times this week. Word is spreading.`,
    severity: SEVERITY.GOOD,
    confidence: Math.min(85, 50 + shares7 * 5),
    why: [
      `${shares7} shares this week`,
      sharesPrev7 > 0 ? `${sharesPrev7} shares last week` : 'New sharing activity',
      growth > 0 ? `${growth}% increase` : null,
    ],
    metrics: { shares7, sharesPrev7, growth },
    recommendedActions: [
      { label: 'Create shareable content', type: 'primary' },
      { label: 'Thank fans who share', type: 'secondary' },
    ],
    window: '7d',
  }));
  
  return insights;
}

/**
 * INSIGHT: Tour State Opportunity
 * Pre-show and post-show insights
 * ELITE: 72h pre-show window, post-show recap window
 */
function analyzeTourState({ events, today, todayPartial }) {
  const insights = [];
  
  if (!events || !events.length) return insights;
  
  const now = new Date();
  
  // Find upcoming events (within 72 hours = 3 days)
  const upcoming = events.filter(e => {
    const eventDate = new Date(e.date || e.startDate);
    const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 3;
  });
  
  // Find recent events (within 3 days after)
  const recent = events.filter(e => {
    const eventDate = new Date(e.date || e.startDate);
    const daysSince = Math.ceil((now - eventDate) / (1000 * 60 * 60 * 24));
    return daysSince > 0 && daysSince <= 3;
  });
  
  // ELITE: Pre-show window (72h) - push QR placements / announce show
  if (upcoming.length > 0) {
    const nextEvent = upcoming[0];
    const eventDate = new Date(nextEvent.date || nextEvent.startDate);
    const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    const hoursUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60));
    
    const isShowDay = daysUntil === 0;
    const isImminentShow = hoursUntil <= 6 && hoursUntil > 0;
    
    insights.push(createInsight({
      key: 'tour_preshow',
      category: CATEGORY.TOUR,
      title: isShowDay ? (isImminentShow ? 'Showtime Soon!' : 'Show Day!') : `Show in ${daysUntil} Day${daysUntil > 1 ? 's' : ''}`,
      summary: isShowDay 
        ? `You're playing ${nextEvent.venue || nextEvent.city || 'tonight'}. Push your link hard today.`
        : `${nextEvent.venue || nextEvent.city} is coming up. Time to build anticipation.`,
      severity: isShowDay ? SEVERITY.CRITICAL : (daysUntil <= 1 ? SEVERITY.WARNING : SEVERITY.INFO),
      confidence: 95,
      why: [
        `Event: ${nextEvent.title || nextEvent.venue || 'Upcoming show'}`,
        `Date: ${eventDate.toLocaleDateString()}`,
        nextEvent.city ? `City: ${nextEvent.city}` : null,
      ],
      metrics: { eventId: nextEvent.id, daysUntil, hoursUntil },
      recommendedActions: [
        isShowDay ? { label: 'Display QR at venue', route: '/qr', type: 'primary' } : { label: 'Announce show', type: 'primary' },
        { label: 'Post on socials', type: 'secondary' },
      ],
      window: '72h',
    }));
  }
  
  // ELITE: Post-show energy window - publish recap / shareable moment
  if (recent.length > 0) {
    const lastEvent = recent[0];
    const eventDate = new Date(lastEvent.date || lastEvent.startDate);
    const daysSince = Math.ceil((now - eventDate) / (1000 * 60 * 60 * 24));
    
    insights.push(createInsight({
      key: 'tour_postshow',
      category: CATEGORY.TOUR,
      title: 'Post-Show Energy',
      summary: `You played ${lastEvent.venue || lastEvent.city || 'recently'} ${daysSince} day${daysSince > 1 ? 's' : ''} ago. Fans are still warm - publish a recap!`,
      severity: daysSince === 1 ? SEVERITY.WARNING : SEVERITY.INFO,
      confidence: 90,
      why: [
        `Event: ${lastEvent.title || lastEvent.venue || 'Recent show'}`,
        `${daysSince} day${daysSince > 1 ? 's' : ''} since show`,
        'Post-show engagement typically spikes 24-72h after',
      ],
      metrics: { eventId: lastEvent.id, daysSince },
      recommendedActions: [
        { label: 'Publish recap', type: 'primary' },
        { label: 'Share photos/videos', type: 'secondary' },
      ],
      window: '72h',
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Mobile Audience
 * Identifies mobile-heavy traffic
 */
function analyzeMobileAudience({ today, last7, todayPartial }) {
  const insights = [];
  
  // Use 7d aggregate for stability
  let mobile = 0, desktop = 0, tablet = 0;
  
  for (const row of (last7 || [])) {
    mobile += row.deviceMobile || 0;
    desktop += row.deviceDesktop || 0;
    tablet += row.deviceTablet || 0;
  }
  
  // Add today partial if available
  if (todayPartial) {
    mobile += todayPartial.deviceMobile || 0;
    desktop += todayPartial.deviceDesktop || 0;
    tablet += todayPartial.deviceTablet || 0;
  }
  
  const total = mobile + desktop + tablet;
  if (total < 30) return insights;
  
  const mobileShare = Math.round((mobile / total) * 100);
  
  if (mobileShare >= 75) {
    insights.push(createInsight({
      key: 'mobile_audience',
      category: CATEGORY.AUDIENCE,
      title: 'Mobile-First Audience',
      summary: `${mobileShare}% of your visitors are on mobile. Keep your page fast and thumb-friendly.`,
      severity: SEVERITY.INFO,
      confidence: Math.min(90, 60 + total / 10),
      why: [
        `${mobile} mobile visitors`,
        `${desktop} desktop visitors`,
        `${mobileShare}% mobile share`,
      ],
      metrics: { mobile, desktop, tablet, mobileShare, total },
      recommendedActions: [
        { label: 'Test on mobile', type: 'secondary' },
        { label: 'Keep CTAs above fold', type: 'secondary' },
      ],
      window: '7d',
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Source Shift Detection
 * ELITE NEW: Identifies when traffic source mix changes significantly
 */
function analyzeSourceShift({ last7, prev7 }) {
  const insights = [];
  
  // Aggregate source data
  const sourceMap7 = {};
  const sourceMapPrev7 = {};
  
  for (const row of (last7 || [])) {
    for (const [source, count] of (row.sources || [])) {
      if (!source || source === 'unknown') continue;
      sourceMap7[source] = (sourceMap7[source] || 0) + count;
    }
  }
  
  for (const row of (prev7 || [])) {
    for (const [source, count] of (row.sources || [])) {
      if (!source || source === 'unknown') continue;
      sourceMapPrev7[source] = (sourceMapPrev7[source] || 0) + count;
    }
  }
  
  const total7 = Object.values(sourceMap7).reduce((a, b) => a + b, 0);
  const totalPrev7 = Object.values(sourceMapPrev7).reduce((a, b) => a + b, 0);
  
  // Need minimum volume
  if (total7 < 30 || totalPrev7 < 20) return insights;
  
  // Find sources with significant share change
  for (const [source, count] of Object.entries(sourceMap7)) {
    const prevCount = sourceMapPrev7[source] || 0;
    const share7 = (count / total7) * 100;
    const sharePrev7 = totalPrev7 > 0 ? (prevCount / totalPrev7) * 100 : 0;
    const shareDelta = share7 - sharePrev7;
    
    // Significant shift: >15% share change and source has meaningful volume
    if (shareDelta >= 15 && count >= 10) {
      const sourceName = source.charAt(0).toUpperCase() + source.slice(1);
      
      insights.push(createInsight({
        key: `source_shift_${source.toLowerCase()}`,
        category: CATEGORY.SOURCE,
        title: `${sourceName} Traffic Rising`,
        summary: `${sourceName} now drives ${Math.round(share7)}% of your traffic, up from ${Math.round(sharePrev7)}%. Double down on this channel.`,
        severity: SEVERITY.GOOD,
        confidence: Math.min(85, 55 + count / 5),
        why: [
          `This week: ${count} visits from ${sourceName} (${Math.round(share7)}%)`,
          `Last week: ${prevCount} visits (${Math.round(sharePrev7)}%)`,
          `Share increased by ${Math.round(shareDelta)} percentage points`,
        ],
        metrics: { source, count, prevCount, share7, sharePrev7, shareDelta },
        recommendedActions: [
          { label: `Double down on ${sourceName}`, type: 'primary' },
          { label: 'Analyze what worked', type: 'secondary' },
        ],
        window: '7d',
      }));
      
      // Only report top source shift
      break;
    }
  }
  
  return insights;
}

/**
 * Main entry point: Generate all insights for a band
 * ELITE: Recomputes on every request, supports todayPartial for freshness
 */
async function generateInsights({ bandId, dailyRows, events, shareData, todayPartial = null }) {
  const allInsights = [];
  
  // Prepare data windows
  const sorted = (dailyRows || []).sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  const today = sorted[0];
  const yesterday = sorted[1];
  const last7 = sorted.slice(0, 7);
  const prev7 = sorted.slice(7, 14);
  
  // Context object for all analyzers
  const ctx = { last7, prev7, today, yesterday, todayPartial, events, shareData };
  
  // Run all analyzers (including 3 new elite ones)
  const analyzers = [
    () => analyzeTrafficMomentum(ctx),
    () => analyzeEngagement(ctx),
    () => analyzeCitySpike(ctx),
    () => analyzePlatformPull(ctx),
    () => analyzeShareChain(ctx),
    () => analyzeTourState(ctx),
    () => analyzeMobileAudience(ctx),
    () => analyzeSourceShift(ctx), // NEW ELITE
  ];
  
  for (const analyze of analyzers) {
    try {
      const insights = analyze();
      allInsights.push(...insights);
    } catch (err) {
      // Graceful degradation - don't break on individual analyzer failure
      console.warn('[InsightsEngine] Analyzer failed:', err.message);
    }
  }
  
  // ELITE: Sort by impact score (severityWeight * confidence)
  allInsights.sort((a, b) => {
    // Primary: impact score (higher first)
    const impactDiff = (b._impactScore || 0) - (a._impactScore || 0);
    if (Math.abs(impactDiff) > 0.1) return impactDiff;
    // Secondary: severity order
    const severityOrder = { critical: 0, warning: 1, good: 2, info: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  // ELITE: Ensure at least 1 "good" insight if any positive signals exist
  const hasGood = allInsights.some(i => i.severity === 'good');
  if (!hasGood) {
    // Check if there's any good insight that was ranked lower
    const goodInsight = allInsights.find(i => i.severity === 'good');
    if (goodInsight) {
      // Move it up
      const idx = allInsights.indexOf(goodInsight);
      if (idx > 6) {
        allInsights.splice(idx, 1);
        allInsights.splice(5, 0, goodInsight);
      }
    }
  }
  
  // ELITE: Dedupe by category (keep highest scoring per category)
  const seenCategories = new Set();
  const dedupedInsights = [];
  for (const insight of allInsights) {
    // Allow multiple tour insights (pre/post)
    const categoryKey = insight.category === 'tour' ? `${insight.category}_${insight.key}` : insight.category;
    if (!seenCategories.has(categoryKey)) {
      seenCategories.add(categoryKey);
      dedupedInsights.push(insight);
    }
  }
  
  // ELITE: Return max 7 insights, remove internal scoring field
  return dedupedInsights.slice(0, 7).map(({ _impactScore, ...insight }) => insight);
}

module.exports = {
  SEVERITY,
  CATEGORY,
  createInsight,
  generateInsights,
  // Export individual analyzers for testing
  analyzeTrafficMomentum,
  analyzeEngagement,
  analyzeCitySpike,
  analyzePlatformPull,
  analyzeShareChain,
  analyzeTourState,
  analyzeMobileAudience,
  analyzeSourceShift,
};
