'use strict';

/**
 * Muse Insights Engine v2
 * 
 * Generates high-quality, actionable insights with:
 * - Consistent shape (key, title, summary, severity, confidence, why, recommendedActions)
 * - Improved thresholds to reduce noise
 * - Graceful degradation when data is missing
 */

const SEVERITY = {
  CRITICAL: 'critical',  // Needs immediate attention
  WARNING: 'warning',    // Should address soon
  GOOD: 'good',          // Positive signal
  INFO: 'info',          // Neutral information
};

/**
 * Create a standardized insight object
 */
function createInsight({
  key,
  title,
  summary,
  severity = SEVERITY.INFO,
  confidence = 50,
  why = [],
  recommendedActions = [],
  dataWindow = '7d',
  metricsSnapshot = {},
}) {
  return {
    key,
    title,
    summary,
    severity,
    confidence: Math.min(100, Math.max(0, Math.round(confidence))),
    why: Array.isArray(why) ? why : [why],
    recommendedActions,
    dataWindow,
    metricsSnapshot,
    generatedAt: new Date().toISOString(),
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
 */
function analyzeTrafficMomentum({ last7, prev7, today, yesterday }) {
  const insights = [];
  
  const pv7 = sum(last7, r => r.pageViews);
  const pvPrev7 = sum(prev7, r => r.pageViews);
  const pvToday = today?.pageViews || 0;
  const pvYesterday = yesterday?.pageViews || 0;
  
  // Skip if insufficient data
  if (pv7 < 5 && pvPrev7 < 5) return insights;
  
  const weekDelta = pctChange(pv7, pvPrev7);
  const dayDelta = pctChange(pvToday, pvYesterday);
  
  // Only generate insight if change is significant (>15%)
  if (Math.abs(weekDelta) >= 15) {
    const isGrowth = weekDelta > 0;
    const severity = isGrowth 
      ? (weekDelta >= 50 ? SEVERITY.GOOD : SEVERITY.INFO)
      : (weekDelta <= -30 ? SEVERITY.WARNING : SEVERITY.INFO);
    
    const confidence = Math.min(95, 50 + Math.abs(weekDelta) / 2 + (pv7 > 50 ? 20 : 0));
    
    insights.push(createInsight({
      key: 'traffic_momentum_week',
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
      recommendedActions: isGrowth ? [
        { label: 'Capitalize with a post', route: null, type: 'suggestion' },
        { label: 'Check what\'s driving traffic', route: '/analytics/{bandId}', type: 'navigate' },
      ] : [
        { label: 'Review traffic sources', route: '/analytics/{bandId}', type: 'navigate' },
        { label: 'Share your link', route: null, type: 'suggestion' },
      ],
      dataWindow: '7d',
      metricsSnapshot: { pv7, pvPrev7, weekDelta },
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Engagement Quality
 * Measures how well visitors are engaging with content
 */
function analyzeEngagement({ last7, today }) {
  const insights = [];
  
  const pv7 = sum(last7, r => r.pageViews);
  const clicks7 = sum(last7, r => r.linkClicks);
  const songs7 = sum(last7, r => r.songPlays);
  const videos7 = sum(last7, r => r.videoPlays);
  
  if (pv7 < 10) return insights; // Need minimum traffic
  
  const totalEngagements = clicks7 + songs7 + videos7;
  const engagementRate = Math.round((totalEngagements / pv7) * 100);
  
  // High engagement (>40%)
  if (engagementRate >= 40) {
    insights.push(createInsight({
      key: 'engagement_high',
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
      recommendedActions: [
        { label: 'Keep momentum going', route: null, type: 'suggestion' },
      ],
      dataWindow: '7d',
      metricsSnapshot: { engagementRate, clicks7, songs7, videos7, pv7 },
    }));
  }
  // Low engagement with decent traffic (warning)
  else if (engagementRate < 15 && pv7 >= 30) {
    insights.push(createInsight({
      key: 'engagement_low',
      title: 'Engagement Opportunity',
      summary: `Only ${engagementRate}% of visitors are engaging. Consider refreshing your featured content.`,
      severity: SEVERITY.WARNING,
      confidence: Math.min(85, 55 + pv7 / 20),
      why: [
        `${pv7} visitors but only ${totalEngagements} engagements`,
        'Visitors may not be finding what they\'re looking for',
        'Featured content might need updating',
      ],
      recommendedActions: [
        { label: 'Update featured song', route: '/edit/{bandId}', type: 'navigate' },
        { label: 'Add a video', route: '/edit/{bandId}', type: 'navigate' },
        { label: 'Check link placement', route: null, type: 'suggestion' },
      ],
      dataWindow: '7d',
      metricsSnapshot: { engagementRate, totalEngagements, pv7 },
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: City Spike Detection
 * Identifies when a city suddenly becomes hot
 */
function analyzeCitySpike({ last7, prev7, today }) {
  const insights = [];
  
  // Aggregate city data
  const cityMap7 = {};
  const cityMapPrev7 = {};
  
  for (const row of (last7 || [])) {
    for (const [city, count] of (row.topCities || [])) {
      cityMap7[city] = (cityMap7[city] || 0) + count;
    }
  }
  
  for (const row of (prev7 || [])) {
    for (const [city, count] of (row.topCities || [])) {
      cityMapPrev7[city] = (cityMapPrev7[city] || 0) + count;
    }
  }
  
  // Find cities with significant growth
  for (const [city, count] of Object.entries(cityMap7)) {
    if (count < 5) continue; // Minimum threshold
    
    const prevCount = cityMapPrev7[city] || 0;
    const growth = pctChange(count, prevCount);
    
    // City spike: >100% growth or new city with 10+ views
    if (growth >= 100 || (prevCount === 0 && count >= 10)) {
      const isNew = prevCount === 0;
      
      insights.push(createInsight({
        key: `city_spike_${city.toLowerCase().replace(/\s+/g, '_')}`,
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
        recommendedActions: [
          { label: 'Consider targeting this city', route: null, type: 'suggestion' },
          { label: 'Check for upcoming shows nearby', route: '/events', type: 'navigate' },
        ],
        dataWindow: '7d',
        metricsSnapshot: { city, count, prevCount, growth },
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
  
  if (totalClicks < 10) return insights;
  
  const share = Math.round((topCount / totalClicks) * 100);
  
  // Only report if one platform dominates (>50%)
  if (share >= 50) {
    const platformName = topPlatform.charAt(0).toUpperCase() + topPlatform.slice(1);
    
    insights.push(createInsight({
      key: 'platform_pull',
      title: `${platformName} Leading`,
      summary: `${share}% of your link clicks go to ${platformName}. Your fans know where they want to go.`,
      severity: SEVERITY.INFO,
      confidence: Math.min(90, 60 + totalClicks / 5),
      why: [
        `${topCount} clicks to ${platformName}`,
        `${totalClicks} total link clicks`,
        `${share}% share`,
      ],
      recommendedActions: [
        { label: `Make sure ${platformName} profile is updated`, route: null, type: 'suggestion' },
        { label: 'Feature this link prominently', route: '/edit/{bandId}', type: 'navigate' },
      ],
      dataWindow: '7d',
      metricsSnapshot: { topPlatform, topCount, totalClicks, share },
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Share Chain Detection
 * Identifies when content is being shared
 */
function analyzeShareChain({ shareData, last7 }) {
  const insights = [];
  
  const shares7 = shareData?.shares7 || sum(last7, r => r.shares || 0);
  const sharesPrev7 = shareData?.sharesPrev7 || 0;
  
  if (shares7 < 3) return insights;
  
  const growth = pctChange(shares7, sharesPrev7);
  
  if (shares7 >= 5 || growth >= 50) {
    insights.push(createInsight({
      key: 'share_chain',
      title: 'Fans Are Sharing',
      summary: `Your content was shared ${shares7} times this week. Word is spreading.`,
      severity: SEVERITY.GOOD,
      confidence: Math.min(85, 50 + shares7 * 5),
      why: [
        `${shares7} shares this week`,
        sharesPrev7 > 0 ? `${sharesPrev7} shares last week` : 'New sharing activity',
        growth > 0 ? `${growth}% increase` : null,
      ].filter(Boolean),
      recommendedActions: [
        { label: 'Create shareable content', route: null, type: 'suggestion' },
        { label: 'Thank fans who share', route: null, type: 'suggestion' },
      ],
      dataWindow: '7d',
      metricsSnapshot: { shares7, sharesPrev7, growth },
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Tour State Opportunity
 * Pre-show and post-show insights
 */
function analyzeTourState({ events, today }) {
  const insights = [];
  
  if (!events || !events.length) return insights;
  
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  
  // Find upcoming and recent events
  const upcoming = events.filter(e => {
    const eventDate = new Date(e.date || e.startDate);
    const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  });
  
  const recent = events.filter(e => {
    const eventDate = new Date(e.date || e.startDate);
    const daysSince = Math.ceil((now - eventDate) / (1000 * 60 * 60 * 24));
    return daysSince > 0 && daysSince <= 3;
  });
  
  // Pre-show opportunity
  if (upcoming.length > 0) {
    const nextEvent = upcoming[0];
    const eventDate = new Date(nextEvent.date || nextEvent.startDate);
    const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    
    insights.push(createInsight({
      key: 'tour_preshow',
      title: daysUntil === 0 ? 'Show Day!' : `Show in ${daysUntil} Day${daysUntil > 1 ? 's' : ''}`,
      summary: daysUntil === 0 
        ? `You're playing ${nextEvent.venue || nextEvent.city || 'tonight'}. Push your link hard today.`
        : `${nextEvent.venue || nextEvent.city} is coming up. Time to build anticipation.`,
      severity: daysUntil === 0 ? SEVERITY.CRITICAL : SEVERITY.INFO,
      confidence: 95,
      why: [
        `Event: ${nextEvent.title || nextEvent.venue || 'Upcoming show'}`,
        `Date: ${eventDate.toLocaleDateString()}`,
        nextEvent.city ? `City: ${nextEvent.city}` : null,
      ].filter(Boolean),
      recommendedActions: [
        { label: 'Share your link', route: null, type: 'suggestion' },
        { label: 'Post on socials', route: null, type: 'suggestion' },
        daysUntil === 0 ? { label: 'Display QR at venue', route: '/qr', type: 'navigate' } : null,
      ].filter(Boolean),
      dataWindow: '7d',
      metricsSnapshot: { event: nextEvent, daysUntil },
    }));
  }
  
  // Post-show opportunity
  if (recent.length > 0) {
    const lastEvent = recent[0];
    const eventDate = new Date(lastEvent.date || lastEvent.startDate);
    const daysSince = Math.ceil((now - eventDate) / (1000 * 60 * 60 * 24));
    
    insights.push(createInsight({
      key: 'tour_postshow',
      title: 'Post-Show Window',
      summary: `You played ${lastEvent.venue || lastEvent.city || 'recently'} ${daysSince} day${daysSince > 1 ? 's' : ''} ago. Fans are still warm.`,
      severity: SEVERITY.INFO,
      confidence: 90,
      why: [
        `Event: ${lastEvent.title || lastEvent.venue || 'Recent show'}`,
        `${daysSince} day${daysSince > 1 ? 's' : ''} since show`,
        'Post-show engagement typically spikes 24-72h after',
      ],
      recommendedActions: [
        { label: 'Post thank-you content', route: null, type: 'suggestion' },
        { label: 'Share photos/videos', route: null, type: 'suggestion' },
        { label: 'Check for new followers', route: '/analytics/{bandId}', type: 'navigate' },
      ],
      dataWindow: '3d',
      metricsSnapshot: { event: lastEvent, daysSince },
    }));
  }
  
  return insights;
}

/**
 * INSIGHT: Mobile Audience
 * Identifies mobile-heavy traffic
 */
function analyzeMobileAudience({ today, last7 }) {
  const insights = [];
  
  // Use today's data or aggregate from last7
  let mobile = 0, desktop = 0, tablet = 0;
  
  if (today) {
    mobile = today.deviceMobile || 0;
    desktop = today.deviceDesktop || 0;
    tablet = today.deviceTablet || 0;
  } else {
    for (const row of (last7 || [])) {
      mobile += row.deviceMobile || 0;
      desktop += row.deviceDesktop || 0;
      tablet += row.deviceTablet || 0;
    }
  }
  
  const total = mobile + desktop + tablet;
  if (total < 20) return insights;
  
  const mobileShare = Math.round((mobile / total) * 100);
  
  if (mobileShare >= 75) {
    insights.push(createInsight({
      key: 'mobile_audience',
      title: 'Mobile-First Audience',
      summary: `${mobileShare}% of your visitors are on mobile. Keep your page fast and thumb-friendly.`,
      severity: SEVERITY.INFO,
      confidence: Math.min(90, 60 + total / 10),
      why: [
        `${mobile} mobile visitors`,
        `${desktop} desktop visitors`,
        `${mobileShare}% mobile share`,
      ],
      recommendedActions: [
        { label: 'Test your page on mobile', route: null, type: 'suggestion' },
        { label: 'Keep CTAs above the fold', route: null, type: 'suggestion' },
      ],
      dataWindow: today ? '1d' : '7d',
      metricsSnapshot: { mobile, desktop, tablet, mobileShare },
    }));
  }
  
  return insights;
}

/**
 * Main entry point: Generate all insights for a band
 */
async function generateInsights({ bandId, dailyRows, events, shareData }) {
  const allInsights = [];
  
  // Prepare data windows
  const sorted = (dailyRows || []).sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  const today = sorted[0];
  const yesterday = sorted[1];
  const last7 = sorted.slice(0, 7);
  const prev7 = sorted.slice(7, 14);
  
  // Run all analyzers
  const analyzers = [
    () => analyzeTrafficMomentum({ last7, prev7, today, yesterday }),
    () => analyzeEngagement({ last7, today }),
    () => analyzeCitySpike({ last7, prev7, today }),
    () => analyzePlatformPull({ last7 }),
    () => analyzeShareChain({ shareData, last7 }),
    () => analyzeTourState({ events, today }),
    () => analyzeMobileAudience({ today, last7 }),
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
  
  // Sort by severity (critical first) then confidence (highest first)
  const severityOrder = { critical: 0, warning: 1, good: 2, info: 3 };
  allInsights.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });
  
  // Return top 5 insights to avoid noise
  return allInsights.slice(0, 5);
}

module.exports = {
  SEVERITY,
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
};
