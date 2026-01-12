'use strict';

/**
 * band-share controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::band-share.band-share', ({ strapi }) => ({
  /**
   * POST /api/band-shares/record
   * Record a band share event
   */
  async record(ctx) {
    try {
      const { bandId, visitorId, sessionId, shareChannel, placement, context } = ctx.request.body;

      // Validate required fields
      if (!bandId) {
        return ctx.badRequest('Missing required field: bandId');
      }
      if (!visitorId) {
        return ctx.badRequest('Missing required field: visitorId');
      }
      if (!sessionId) {
        return ctx.badRequest('Missing required field: sessionId');
      }
      if (!placement) {
        return ctx.badRequest('Missing required field: placement');
      }

      // Validate placement enum
      const validPlacements = ['FOOTER', 'FAN_MOMENT_SECTION'];
      if (!validPlacements.includes(placement)) {
        return ctx.badRequest(`Invalid placement. Must be one of: ${validPlacements.join(', ')}`);
      }

      // Validate shareChannel enum if provided
      const validChannels = ['WEB_SHARE', 'COPY', 'DOWNLOAD', 'COPY_LINK', 'COPY_CAPTION', 'DOWNLOAD_IMAGE', 'INSTAGRAM_KIT', 'FACEBOOK_SHARE', 'OTHER'];
      if (shareChannel && !validChannels.includes(shareChannel)) {
        return ctx.badRequest(`Invalid shareChannel. Must be one of: ${validChannels.join(', ')}`);
      }

      const now = new Date();

      // Create the share record
      await strapi.db.query('api::band-share.band-share').create({
        data: {
          band: bandId,
          visitorId,
          sessionId,
          shareChannel: shareChannel || 'OTHER',
          placement,
          sharedAt: now.toISOString(),
          context: context || {},
        },
      });

      return ctx.send({ ok: true });
    } catch (err) {
      strapi.log.error('[band-share.record] Error:', err);
      return ctx.internalServerError('Failed to record share');
    }
  },
}));
