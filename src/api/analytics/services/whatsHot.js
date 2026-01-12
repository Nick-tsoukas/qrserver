'use strict';

/**
 * What's Hot / Momentum Prompts Service
 * Generates share-ready prompt cards for band dashboard
 */

const { DateTime } = require('luxon');

// Card type priorities (lower = higher priority)
const CARD_PRIORITY = {
  MILESTONE: 1,
  HOT_CITY: 2,
  NEW_FANS: 3,
  HOT_LINK: 4,
  HOT_MEDIA: 5,
};

// Thresholds for card generation
const THRESHOLDS = {
  HOT_CITY: { minShare: 0.35, minCount: 15 },
  NEW_FANS: { minCount: 25 },
  HOT_LINK: { minCount: 10 },
  HOT_MEDIA: { minCount: 10 },
};

// Milestone thresholds
const MILESTONES = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Caption templates for each card type
 */
const CAPTION_TEMPLATES = {
  HOT_CITY: {
    hype: '{city} is showing love right now 🔥',
    grateful: 'Appreciate everyone in {city} for tapping in 🙏',
    tease: '{city}… we might need to see you soon 👀',
  },
  NEW_FANS: {
    hype: 'New people are finding {bandName} today 👀',
    grateful: 'Appreciate all the new listeners today 🙏',
    tease: "Something's building… stay close.",
  },
  HOT_LINK: {
    hype: 'Most clicked today: {label} 🔥',
    grateful: "If you're new here, start with this 🙏",
    tease: 'This is where to begin… 👀',
  },
  HOT_MEDIA: {
    hype: 'Most played today: {title} 🎧',
    grateful: 'Thanks for running this track today 🙏',
    tease: "If you haven't heard this yet… 👀",
  },
  MILESTONE: {
    hype: 'We just hit {label} 🔥',
    grateful: 'Thanks for getting us to {label} 🙏',
    tease: "We're just getting started… 👀",
  },
};

/**
 * Fetch what's hot data for a band
 * @param {object} strapi - Strapi instance
 * @param {number} bandId - Band ID
 * @param {number} windowHours - Time window (default 24)
 * @returns {Promise<object>} Hot data with cards
 */
async function fetchWhatsHot(strapi, bandId, windowHours = 24) {
  const now = DateTime.utc();
  const from = now.minus({ hours: windowHours }).toISO();
  const to = now.toISO();

  // Get band info
  const band = await strapi.entityService.findOne('api::band.band', bandId, {
    fields: ['id', 'name', 'slug'],
  });

  if (!band) {
    return { ok: false, error: 'Band not found' };
  }

  const bandName = band.name || 'This Artist';
  const bandSlug = band.slug || '';

  // Fetch all analytics data in parallel
  const [
    pageViews,
    linkClicks,
    mediaPlays,
    follows,
  ] = await Promise.all([
    fetchPageViews(strapi, bandId, from, to),
    fetchLinkClicks(strapi, bandId, from, to),
    fetchMediaPlays(strapi, bandId, from, to),
    fetchFollows(strapi, bandId, from, to),
  ]);

  // Calculate hot items
  const hotCity = calculateHotCity(pageViews);
  const hotLink = calculateHotLink(linkClicks);
  const hotMedia = calculateHotMedia(mediaPlays);
  const newVisitors = calculateNewVisitors(pageViews);
  const milestone = await calculateMilestone(strapi, bandId, pageViews.length);

  // Generate cards
  const cards = generateCards({
    bandName,
    bandSlug,
    hotCity,
    hotLink,
    hotMedia,
    newVisitors,
    milestone,
    totalViews: pageViews.length,
    totalClicks: linkClicks.length,
    totalPlays: mediaPlays.length,
    totalFollows: follows.length,
  });

  return {
    ok: true,
    bandId,
    bandName,
    bandSlug,
    windowHours,
    hot: {
      city: hotCity,
      link: hotLink,
      media: hotMedia,
      newVisitors,
      milestone,
      cards,
      summary: {
        totalViews: pageViews.length,
        totalClicks: linkClicks.length,
        totalPlays: mediaPlays.length,
        totalFollows: follows.length,
      },
    },
  };
}

/**
 * Fetch page views with visitor tracking
 */
async function fetchPageViews(strapi, bandId, from, to) {
  try {
    const rows = await strapi.entityService.findMany('api::band-page-view.band-page-view', {
      filters: {
        band: { id: bandId },
        timestamp: { $gte: from, $lte: to },
      },
      fields: ['id', 'city', 'country', 'visitorId', 'sessionId', 'timestamp'],
      pagination: { limit: 100000 },
    });
    return rows || [];
  } catch (err) {
    strapi.log.error('[whatsHot] fetchPageViews error:', err);
    return [];
  }
}

/**
 * Fetch link clicks
 */
async function fetchLinkClicks(strapi, bandId, from, to) {
  try {
    const rows = await strapi.entityService.findMany('api::link-click.link-click', {
      filters: {
        band: { id: bandId },
        timestamp: { $gte: from, $lte: to },
      },
      fields: ['id', 'linkLabel', 'linkUrl', 'timestamp'],
      pagination: { limit: 100000 },
    });
    return rows || [];
  } catch (err) {
    strapi.log.error('[whatsHot] fetchLinkClicks error:', err);
    return [];
  }
}

/**
 * Fetch media plays
 */
async function fetchMediaPlays(strapi, bandId, from, to) {
  try {
    const rows = await strapi.entityService.findMany('api::media-play.media-play', {
      filters: {
        band: { id: bandId },
        timestamp: { $gte: from, $lte: to },
      },
      fields: ['id', 'mediaType', 'mediaTitle', 'timestamp'],
      pagination: { limit: 100000 },
    });
    return rows || [];
  } catch (err) {
    strapi.log.error('[whatsHot] fetchMediaPlays error:', err);
    return [];
  }
}

/**
 * Fetch follows
 */
async function fetchFollows(strapi, bandId, from, to) {
  try {
    // Check if follow tracking exists - use band-page-view with follow action or separate table
    // For now, return empty if no follow table exists
    return [];
  } catch (err) {
    return [];
  }
}

/**
 * Calculate hot city from page views
 */
function calculateHotCity(pageViews) {
  if (!pageViews.length) return null;

  const cityMap = {};
  pageViews.forEach((pv) => {
    const city = pv.city || 'Unknown';
    if (city === 'Unknown') return;
    cityMap[city] = (cityMap[city] || 0) + 1;
  });

  const cities = Object.entries(cityMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  if (cities.length === 0) return null;

  const topCity = cities[0];
  const totalWithCity = pageViews.filter((pv) => pv.city && pv.city !== 'Unknown').length;
  const share = totalWithCity > 0 ? topCity.count / totalWithCity : 0;

  return {
    name: topCity.name,
    count: topCity.count,
    share: Math.round(share * 100) / 100,
    meetsThreshold: share >= THRESHOLDS.HOT_CITY.minShare || topCity.count >= THRESHOLDS.HOT_CITY.minCount,
  };
}

/**
 * Calculate hot link from clicks
 */
function calculateHotLink(linkClicks) {
  if (!linkClicks.length) return null;

  const linkMap = {};
  linkClicks.forEach((lc) => {
    const label = lc.linkLabel || lc.linkUrl || 'Unknown';
    if (!linkMap[label]) {
      linkMap[label] = { label, url: lc.linkUrl, count: 0 };
    }
    linkMap[label].count++;
  });

  const links = Object.values(linkMap).sort((a, b) => b.count - a.count);

  if (links.length === 0) return null;

  const topLink = links[0];
  return {
    label: topLink.label,
    url: topLink.url,
    count: topLink.count,
    meetsThreshold: topLink.count >= THRESHOLDS.HOT_LINK.minCount,
  };
}

/**
 * Calculate hot media from plays
 */
function calculateHotMedia(mediaPlays) {
  if (!mediaPlays.length) return null;

  const mediaMap = {};
  mediaPlays.forEach((mp) => {
    const title = mp.mediaTitle || mp.mediaType || 'Unknown';
    if (!mediaMap[title]) {
      mediaMap[title] = { title, type: mp.mediaType, count: 0 };
    }
    mediaMap[title].count++;
  });

  const media = Object.values(mediaMap).sort((a, b) => b.count - a.count);

  if (media.length === 0) return null;

  const topMedia = media[0];
  return {
    title: topMedia.title,
    type: topMedia.type,
    count: topMedia.count,
    meetsThreshold: topMedia.count >= THRESHOLDS.HOT_MEDIA.minCount,
  };
}

/**
 * Calculate new visitors (distinct visitorIds)
 */
function calculateNewVisitors(pageViews) {
  const visitorIds = new Set();
  pageViews.forEach((pv) => {
    if (pv.visitorId) {
      visitorIds.add(pv.visitorId);
    }
  });

  const count = visitorIds.size;
  return {
    count,
    meetsThreshold: count >= THRESHOLDS.NEW_FANS.minCount,
  };
}

/**
 * Calculate milestone (if total crosses a threshold)
 */
async function calculateMilestone(strapi, bandId, recentViews) {
  try {
    // Get total page views for this band
    const totalViews = await strapi.db.query('api::band-page-view.band-page-view').count({
      where: { band: bandId },
    });

    // Check if we're at or just crossed a milestone
    for (const threshold of MILESTONES) {
      // If total is within 5% of milestone or just crossed it
      if (totalViews >= threshold && totalViews < threshold * 1.05) {
        return {
          type: 'total_views',
          label: `${threshold} fans`,
          value: threshold,
          current: totalViews,
        };
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Generate cards from hot data
 */
function generateCards(data) {
  const {
    bandName,
    bandSlug,
    hotCity,
    hotLink,
    hotMedia,
    newVisitors,
    milestone,
    totalViews,
    totalClicks,
    totalPlays,
  } = data;

  const cards = [];

  // 1. MILESTONE card (highest priority)
  if (milestone) {
    cards.push({
      type: 'MILESTONE',
      priority: CARD_PRIORITY.MILESTONE,
      title: `🎯 ${milestone.label}`,
      why: `You just hit a milestone! ${milestone.current} total fans have checked you out.`,
      stat: `${milestone.value}+ fans`,
      payload: {
        milestone,
        bandName,
        bandSlug,
      },
      captions: interpolateCaptions(CAPTION_TEMPLATES.MILESTONE, {
        label: milestone.label,
        bandName,
      }),
    });
  }

  // 2. HOT_CITY card
  if (hotCity && hotCity.meetsThreshold) {
    cards.push({
      type: 'HOT_CITY',
      priority: CARD_PRIORITY.HOT_CITY,
      title: `📍 ${hotCity.name} is heating up`,
      why: `${Math.round(hotCity.share * 100)}% of your traffic today is from ${hotCity.name}.`,
      stat: `${hotCity.count} fans from ${hotCity.name}`,
      payload: {
        city: hotCity.name,
        count: hotCity.count,
        share: hotCity.share,
        bandName,
        bandSlug,
      },
      captions: interpolateCaptions(CAPTION_TEMPLATES.HOT_CITY, {
        city: hotCity.name,
        bandName,
      }),
    });
  }

  // 3. NEW_FANS card
  if (newVisitors && newVisitors.meetsThreshold) {
    cards.push({
      type: 'NEW_FANS',
      priority: CARD_PRIORITY.NEW_FANS,
      title: `👀 ${newVisitors.count} new fans today`,
      why: `New people are discovering you. Keep the momentum going!`,
      stat: `${newVisitors.count} unique visitors`,
      payload: {
        count: newVisitors.count,
        bandName,
        bandSlug,
      },
      captions: interpolateCaptions(CAPTION_TEMPLATES.NEW_FANS, {
        count: newVisitors.count,
        bandName,
      }),
    });
  }

  // 4. HOT_LINK card
  if (hotLink && hotLink.meetsThreshold) {
    cards.push({
      type: 'HOT_LINK',
      priority: CARD_PRIORITY.HOT_LINK,
      title: `🔗 "${hotLink.label}" is trending`,
      why: `This link is getting the most clicks today.`,
      stat: `${hotLink.count} clicks`,
      payload: {
        label: hotLink.label,
        url: hotLink.url,
        count: hotLink.count,
        bandName,
        bandSlug,
      },
      captions: interpolateCaptions(CAPTION_TEMPLATES.HOT_LINK, {
        label: hotLink.label,
        bandName,
      }),
    });
  }

  // 5. HOT_MEDIA card
  if (hotMedia && hotMedia.meetsThreshold) {
    cards.push({
      type: 'HOT_MEDIA',
      priority: CARD_PRIORITY.HOT_MEDIA,
      title: `🎧 "${hotMedia.title}" is on repeat`,
      why: `This is your most played content today.`,
      stat: `${hotMedia.count} plays`,
      payload: {
        title: hotMedia.title,
        type: hotMedia.type,
        count: hotMedia.count,
        bandName,
        bandSlug,
      },
      captions: interpolateCaptions(CAPTION_TEMPLATES.HOT_MEDIA, {
        title: hotMedia.title,
        bandName,
      }),
    });
  }

  // Sort by priority and limit to 5
  cards.sort((a, b) => a.priority - b.priority);
  return cards.slice(0, 5);
}

/**
 * Interpolate caption templates with data
 */
function interpolateCaptions(templates, data) {
  const result = {};
  for (const [key, template] of Object.entries(templates)) {
    result[key] = template.replace(/\{(\w+)\}/g, (match, field) => {
      return data[field] !== undefined ? data[field] : match;
    });
  }
  return result;
}

module.exports = {
  fetchWhatsHot,
  THRESHOLDS,
  CARD_PRIORITY,
};
