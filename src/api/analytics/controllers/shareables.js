'use strict';

/**
 * Shareables Controller
 * GET /api/pulse/shareables?bandId=123
 * POST /api/pulse/shareables/track
 */

const { trackShare } = require('../services/shareTracking');

module.exports = {
  async getShareables(ctx) {
    const { bandId, windows, dev } = ctx.query;

    if (!bandId) {
      return ctx.badRequest('bandId is required');
    }

    const parsedBandId = parseInt(bandId, 10);
    if (isNaN(parsedBandId)) {
      return ctx.badRequest('bandId must be a number');
    }

    // Parse windows if provided
    let parsedWindows = ['2h', '24h', '7d', '30d'];
    if (windows) {
      try {
        parsedWindows = typeof windows === 'string' ? windows.split(',') : windows;
      } catch (e) {
        // Use default
      }
    }

    // Parse dev flag
    const isDev = dev === 'true' || dev === '1';

    try {
      const { evaluateShareables } = require('../services/shareables');
      const result = await evaluateShareables(strapi, {
        bandId: parsedBandId,
        windows: parsedWindows,
        dev: isDev,
      });

      return result;
    } catch (err) {
      strapi.log.error('[shareables] Error evaluating shareables:', err);
      return ctx.internalServerError('Failed to evaluate shareables');
    }
  },

  /**
   * Track a share action
   * POST /api/pulse/shareables/track
   * 
   * Body: {
   *   bandId, shareableId, cardType, window, accent,
   *   captionStyle, placement, action, visitorId?, sessionId?
   * }
   */
  async trackShare(ctx) {
    const body = ctx.request.body;

    if (!body || !body.bandId) {
      return ctx.badRequest('bandId is required');
    }

    const parsedBandId = parseInt(body.bandId, 10);
    if (isNaN(parsedBandId)) {
      return ctx.badRequest('bandId must be a number');
    }

    try {
      const result = await trackShare(strapi, {
        bandId: parsedBandId,
        shareableId: body.shareableId,
        cardType: body.cardType,
        window: body.window,
        accent: body.accent,
        captionStyle: body.captionStyle,
        placement: body.placement || 'dashboard',
        action: body.action || 'other',
        visitorId: body.visitorId,
        sessionId: body.sessionId,
      });

      return result;
    } catch (err) {
      strapi.log.error('[shareables] Error tracking share:', err);
      return ctx.internalServerError('Failed to track share');
    }
  },
};
