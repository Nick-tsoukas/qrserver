'use strict';

/**
 * MBQ Shareables V1 — Share Tracking Service
 * 
 * Unified tracking for all share actions from shareable cards.
 * Feeds SHARE_CHAIN eligibility and future virality insights.
 */

/**
 * Track a share action
 * @param {object} strapi 
 * @param {object} payload - Share tracking payload
 * @returns {Promise<{ ok: boolean, shareId?: number, error?: string }>}
 */
async function trackShare(strapi, payload) {
  const {
    bandId,
    shareableId,
    cardType,
    window,
    accent,
    captionStyle,
    placement,
    action,
    visitorId,
    sessionId,
  } = payload;

  // Validate required fields
  if (!bandId) {
    return { ok: false, error: 'bandId is required' };
  }
  if (!action) {
    return { ok: false, error: 'action is required' };
  }
  if (!placement) {
    return { ok: false, error: 'placement is required' };
  }

  // Map action to shareChannel enum
  const channelMap = {
    webShare: 'WEB_SHARE',
    copyLink: 'COPY_LINK',
    copyCaption: 'COPY_CAPTION',
    download: 'DOWNLOAD_IMAGE',
    instagram: 'INSTAGRAM_KIT',
    facebook: 'FACEBOOK_SHARE',
  };
  const shareChannel = channelMap[action] || 'OTHER';

  // Map placement to enum
  const placementMap = {
    dashboard: 'DASHBOARD',
    drawer: 'DRAWER',
  };
  const placementEnum = placementMap[placement] || 'DASHBOARD';

  try {
    const share = await strapi.entityService.create('api::band-share.band-share', {
      data: {
        band: bandId,
        visitorId: visitorId || null,
        sessionId: sessionId || null,
        shareChannel,
        placement: placementEnum,
        sharedAt: new Date().toISOString(),
        shareableId: shareableId || null,
        cardType: cardType || null,
        window: window || null,
        accent: accent || null,
        captionStyle: captionStyle || null,
        context: {
          action,
          timestamp: Date.now(),
        },
      },
    });

    strapi.log.info(`[shareTracking] Tracked share: band=${bandId}, type=${cardType}, action=${action}`);

    return { ok: true, shareId: share.id };
  } catch (err) {
    strapi.log.error('[shareTracking] Failed to track share:', err);
    return { ok: false, error: 'Failed to track share' };
  }
}

/**
 * Get share count for a band within a time window
 * Used for SHARE_CHAIN eligibility
 * @param {object} strapi 
 * @param {number} bandId 
 * @param {string} windowKey - '2h', '24h', '7d', '30d'
 * @returns {Promise<number>}
 */
async function getShareCount(strapi, bandId, windowKey) {
  const windowHours = {
    '2h': 2,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
  };

  const hours = windowHours[windowKey] || 24;
  const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const shares = await strapi.entityService.findMany('api::band-share.band-share', {
      filters: {
        band: { id: bandId },
        sharedAt: { $gte: from },
      },
      pagination: { limit: 10000 },
    });

    return shares?.length || 0;
  } catch (err) {
    strapi.log.warn('[shareTracking] Failed to get share count:', err.message);
    return 0;
  }
}

module.exports = {
  trackShare,
  getShareCount,
};
