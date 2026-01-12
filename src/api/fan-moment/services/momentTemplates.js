'use strict';

/**
 * Moment Templates Service
 * Generates rich, contextual messaging for fan moments based on trigger type and context
 */

/**
 * Template definitions for each moment type
 * Each template has variations to keep content fresh
 */
const TEMPLATES = {
  // Fan-initiated moments (from page visits, QR scans, etc.)
  I_WAS_THERE: {
    qr_scan: [
      {
        title: "🎸 I Was There",
        subtitle: "Live at the show",
        text: "I scanned in at {bandName}'s show and became part of the moment!",
        cta: "Check them out",
      },
      {
        title: "🎤 Show Mode: Activated",
        subtitle: "In the crowd",
        text: "Just checked in at {bandName}'s show. The energy is real!",
        cta: "Join the fanbase",
      },
    ],
    page_view: [
      {
        title: "👀 I Discovered Something",
        subtitle: "New fan alert",
        text: "Just found {bandName} and I'm here for it.",
        cta: "Check them out",
      },
      {
        title: "🎵 On My Radar",
        subtitle: "Tuning in",
        text: "I'm checking out {bandName} - you should too.",
        cta: "Listen now",
      },
    ],
    link_click: [
      {
        title: "🔗 I Went Deeper",
        subtitle: "Following the music",
        text: "Just dove into {bandName}'s world. This is good.",
        cta: "Explore their music",
      },
    ],
    event_view: [
      {
        title: "📅 I'm Planning To Be There",
        subtitle: "Show on the calendar",
        text: "Checking out {bandName}'s upcoming show. Who's coming?",
        cta: "See the show",
      },
    ],
    follow: [
      {
        title: "➕ I'm In",
        subtitle: "New follower",
        text: "Just followed {bandName}. The journey begins!",
        cta: "Follow them too",
      },
    ],
    payment: [
      {
        title: "💰 I Backed The Band",
        subtitle: "Supporting the music",
        text: "Just supported {bandName} directly. Real fans support real music.",
        cta: "Support them too",
      },
    ],
  },

  // Momentum-building moments
  FUELED_MOMENTUM: {
    default: [
      {
        title: "⚡ I Fueled The Fire",
        subtitle: "Adding to the momentum",
        text: "{bandName} is building momentum and I'm part of it!",
        cta: "Join the movement",
      },
      {
        title: "🚀 Momentum Builder",
        subtitle: "Part of the wave",
        text: "I just helped push {bandName} forward. The energy is building!",
        cta: "Add your energy",
      },
    ],
    milestone: [
      {
        title: "🎯 Milestone Moment",
        subtitle: "Fan #{fanPosition}",
        text: "I helped {bandName} hit {milestone}! Fan #{fanPosition} checking in.",
        cta: "Be the next one",
      },
    ],
  },

  // Auto-generated surge moments
  PULSE_SURGE: {
    default: [
      {
        title: "🔥 Caught The Surge",
        subtitle: "{velocity}x normal activity",
        text: "{bandName} is surging right now with {recentInteractions} fans tuning in. I'm part of it!",
        cta: "Join the surge",
      },
      {
        title: "📈 Riding The Wave",
        subtitle: "Activity spike detected",
        text: "Something's happening with {bandName} - {recentInteractions} fans in the last hour!",
        cta: "See what's up",
      },
    ],
  },

  // City-based heat moments
  CITY_HEAT: {
    default: [
      {
        title: "📍 {cityName} Is On Fire",
        subtitle: "{cityInteractions} fans from {cityName}",
        text: "{bandName} is trending in {cityName} and I'm part of the local buzz!",
        cta: "Join your city",
      },
      {
        title: "🌆 Local Heat",
        subtitle: "{cityName} represent",
        text: "{cityName} is showing love for {bandName}. {cityInteractions} of us tuning in!",
        cta: "Rep your city",
      },
    ],
  },

  // Significant milestone moments
  MOMENT_MATTERED: {
    default: [
      {
        title: "💫 This Moment Mattered",
        subtitle: "Part of something real",
        text: "I was here when {bandName} hit a moment. Every fan counts.",
        cta: "Be part of it",
      },
      {
        title: "✨ I Was Part Of This",
        subtitle: "Fan moment earned",
        text: "{bandName} is having a moment and I'm here for it.",
        cta: "Join in",
      },
    ],
    velocity: [
      {
        title: "⚡ {velocity}x The Energy",
        subtitle: "Above baseline",
        text: "{bandName} is running at {velocity}x their normal energy. I'm adding to it!",
        cta: "Add your energy",
      },
    ],
  },

  // After-show recap moments
  AFTER_SHOW_RECAP: {
    default: [
      {
        title: "🎤 Show Recap",
        subtitle: "{eventName}",
        text: "{bandName} just wrapped an amazing show! {totalFans} fans were part of the moment.",
        cta: "Relive the show",
      },
    ],
    stats: [
      {
        title: "📊 The Numbers Are In",
        subtitle: "Post-show stats",
        text: "{bandName}'s show brought {totalFans} fans together. {topCity} showed up big!",
        cta: "See the recap",
      },
    ],
  },
};

/**
 * Generate moment content based on type and context
 * @param {string} momentType - The type of moment (I_WAS_THERE, FUELED_MOMENTUM, etc.)
 * @param {string} actionType - The action that triggered it (qr_scan, page_view, etc.)
 * @param {object} context - Context data for template interpolation
 * @returns {object} Generated moment content
 */
function generateMomentContent(momentType, actionType, context = {}) {
  const typeTemplates = TEMPLATES[momentType];
  if (!typeTemplates) {
    return getDefaultContent(context);
  }

  // Find the right template variant
  let templateVariants;
  
  if (momentType === 'I_WAS_THERE' && typeTemplates[actionType]) {
    templateVariants = typeTemplates[actionType];
  } else if (momentType === 'FUELED_MOMENTUM' && context.milestone && typeTemplates.milestone) {
    templateVariants = typeTemplates.milestone;
  } else if (momentType === 'MOMENT_MATTERED' && context.velocity > 2 && typeTemplates.velocity) {
    templateVariants = typeTemplates.velocity;
  } else if (momentType === 'AFTER_SHOW_RECAP' && context.totalFans && typeTemplates.stats) {
    templateVariants = typeTemplates.stats;
  } else {
    templateVariants = typeTemplates.default || typeTemplates[Object.keys(typeTemplates)[0]];
  }

  if (!templateVariants || templateVariants.length === 0) {
    return getDefaultContent(context);
  }

  // Pick a random template from variants
  const template = templateVariants[Math.floor(Math.random() * templateVariants.length)];

  // Interpolate template with context
  return {
    shareTitle: interpolate(template.title, context),
    shareSubtitle: interpolate(template.subtitle, context),
    shareText: interpolate(template.text, context),
    shareCallToAction: interpolate(template.cta, context),
    shareEmoji: extractEmoji(template.title),
  };
}

/**
 * Interpolate template string with context values
 */
function interpolate(template, context) {
  if (!template) return '';
  
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (context[key] !== undefined && context[key] !== null) {
      // Format numbers nicely
      if (typeof context[key] === 'number') {
        if (key === 'velocity') {
          return context[key].toFixed(1);
        }
        return context[key].toLocaleString();
      }
      return context[key];
    }
    return match; // Keep placeholder if no value
  });
}

/**
 * Extract emoji from title
 */
function extractEmoji(title) {
  if (!title) return '✨';
  const emojiMatch = title.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}])/u);
  return emojiMatch ? emojiMatch[0] : '✨';
}

/**
 * Get default content when no template matches
 */
function getDefaultContent(context) {
  const bandName = context.bandName || 'this artist';
  return {
    shareTitle: '✨ I Was Part Of This',
    shareSubtitle: 'Fan moment',
    shareText: `I was part of a moment for ${bandName}!`,
    shareCallToAction: 'Check them out',
    shareEmoji: '✨',
  };
}

/**
 * Get trigger reason description based on context
 */
function getTriggerReason(momentType, actionType, context = {}) {
  switch (momentType) {
    case 'I_WAS_THERE':
      switch (actionType) {
        case 'qr_scan': return 'Scanned QR code at live show';
        case 'page_view': return 'Visited band page';
        case 'link_click': return 'Clicked a link';
        case 'event_view': return 'Viewed upcoming event';
        case 'follow': return 'Followed the band';
        case 'payment': return 'Made a payment/tip';
        default: return 'Engaged with the band';
      }
    case 'FUELED_MOMENTUM':
      if (context.milestone) return `Helped reach ${context.milestone}`;
      return 'Added to band momentum';
    case 'PULSE_SURGE':
      return `Part of ${context.velocity || 2}x activity surge`;
    case 'CITY_HEAT':
      return `Part of ${context.cityName || 'local'} fan surge`;
    case 'MOMENT_MATTERED':
      return 'Contributed to a significant moment';
    case 'AFTER_SHOW_RECAP':
      return `Part of ${context.eventName || 'show'} recap`;
    default:
      return 'Fan engagement';
  }
}

/**
 * Calculate fan position for milestone moments
 * @param {object} strapi - Strapi instance
 * @param {number} bandId - Band ID
 * @param {string} timeframe - 'day', 'week', 'month', 'all'
 * @returns {Promise<number>} Fan position
 */
async function calculateFanPosition(strapi, bandId, timeframe = 'day') {
  const { DateTime } = require('luxon');
  const now = DateTime.utc();
  
  let fromDate;
  switch (timeframe) {
    case 'week':
      fromDate = now.minus({ weeks: 1 }).toISO();
      break;
    case 'month':
      fromDate = now.minus({ months: 1 }).toISO();
      break;
    case 'all':
      fromDate = null;
      break;
    case 'day':
    default:
      fromDate = now.minus({ days: 1 }).toISO();
  }

  const whereClause = {
    band: bandId,
  };
  
  if (fromDate) {
    whereClause.timestamp = { $gte: fromDate };
  }

  try {
    const count = await strapi.db.query('api::band-page-view.band-page-view').count({
      where: whereClause,
    });
    return count + 1; // +1 because this fan is the next one
  } catch (err) {
    return null;
  }
}

/**
 * Check for milestone achievements
 * @param {object} strapi - Strapi instance
 * @param {number} bandId - Band ID
 * @returns {Promise<object|null>} Milestone info if one was just hit
 */
async function checkMilestone(strapi, bandId) {
  try {
    // Get total page views for this band
    const totalViews = await strapi.db.query('api::band-page-view.band-page-view').count({
      where: { band: bandId },
    });

    // Define milestones
    const milestones = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
    
    // Check if we just crossed a milestone (within last 5 views)
    for (const milestone of milestones) {
      if (totalViews >= milestone && totalViews < milestone + 5) {
        return {
          type: 'total_views',
          value: milestone,
          label: `${milestone} fans`,
          current: totalViews,
        };
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  TEMPLATES,
  generateMomentContent,
  getTriggerReason,
  calculateFanPosition,
  checkMilestone,
  interpolate,
};
