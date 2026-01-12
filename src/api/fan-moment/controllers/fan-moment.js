'use strict';

/**
 * fan-moment controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::fan-moment.fan-moment', ({ strapi }) => ({
  /**
   * POST /api/fan-moments/earn
   * Earn a new fan moment (or return existing active one)
   */
  async earn(ctx) {
    try {
      const { bandId, actionType, visitorId, sessionId, context, pulse } = ctx.request.body;

      if (!bandId || !actionType || !visitorId) {
        return ctx.badRequest('Missing required fields: bandId, actionType, visitorId');
      }

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Check for existing active moment (not expired) for this visitor + band
      const existingMoment = await strapi.db.query('api::fan-moment.fan-moment').findOne({
        where: {
          band: bandId,
          visitorId,
          expiresAt: { $gt: now.toISOString() },
        },
        populate: ['band'],
      });

      if (existingMoment) {
        // Return existing moment
        return ctx.send({
          ok: true,
          moment: formatMoment(existingMoment),
          existing: true,
        });
      }

      // Check 24h cooldown - any moment created in last 24h for this visitor+band
      const recentMoment = await strapi.db.query('api::fan-moment.fan-moment').findOne({
        where: {
          band: bandId,
          visitorId,
          createdAt: { $gt: twentyFourHoursAgo.toISOString() },
        },
      });

      if (recentMoment) {
        return ctx.send({
          ok: false,
          reason: 'cooldown',
          message: 'Moment already earned within 24 hours',
        });
      }

      // Get band info for context
      const band = await strapi.db.query('api::band.band').findOne({
        where: { id: bandId },
      });

      if (!band) {
        return ctx.badRequest('Band not found');
      }

      // Determine moment type based on action and pulse
      let momentType = 'I_WAS_THERE';
      
      // Upgrade to FUELED_MOMENTUM for payments or if pulse is warming/surging
      if (actionType === 'payment') {
        momentType = 'FUELED_MOMENTUM';
      } else if (actionType === 'follow' && pulse) {
        const state = pulse.momentumState || pulse.state;
        if (state === 'warming' || state === 'surging') {
          momentType = 'FUELED_MOMENTUM';
        }
      }

      // Build context
      const momentContext = {
        bandName: band.name || 'This Artist',
        city: context?.city || null,
        state: context?.state || null,
        eventName: context?.eventName || null,
        actionType,
        landingPath: context?.landingPath || null,
        sourceCategory: context?.sourceCategory || null,
      };

      // Generate share text
      const shareTitle = momentType === 'FUELED_MOMENTUM'
        ? `I fueled the moment for ${band.name}`
        : `I was there for ${band.name}`;

      const shareText = momentType === 'FUELED_MOMENTUM'
        ? `Just helped fuel the momentum for ${band.name}! 🔥 #MusicBizQR`
        : `I was part of the moment for ${band.name}! 🎵 #MusicBizQR`;

      // Create the moment
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const newMoment = await strapi.db.query('api::fan-moment.fan-moment').create({
        data: {
          band: bandId,
          visitorId,
          sessionId: sessionId || null,
          momentType,
          actionType,
          expiresAt: expiresAt.toISOString(),
          context: momentContext,
          shareTitle,
          shareText,
          publishedAt: now.toISOString(),
        },
      });

      // Fetch with band populated
      const createdMoment = await strapi.db.query('api::fan-moment.fan-moment').findOne({
        where: { id: newMoment.id },
        populate: ['band'],
      });

      return ctx.send({
        ok: true,
        moment: formatMoment(createdMoment),
        existing: false,
      });
    } catch (err) {
      strapi.log.error('[fan-moment.earn] Error:', err);
      return ctx.internalServerError('Failed to earn moment');
    }
  },

  /**
   * GET /api/fan-moments/active?bandId=...&visitorId=...
   * Get active (non-expired) moment for this visitor + band
   */
  async active(ctx) {
    try {
      const { bandId, visitorId } = ctx.query;

      if (!bandId || !visitorId) {
        return ctx.badRequest('Missing required query params: bandId, visitorId');
      }

      const now = new Date();

      const moment = await strapi.db.query('api::fan-moment.fan-moment').findOne({
        where: {
          band: Number(bandId),
          visitorId,
          expiresAt: { $gt: now.toISOString() },
        },
        populate: ['band'],
      });

      if (!moment) {
        return ctx.send({ ok: true, moment: null });
      }

      return ctx.send({
        ok: true,
        moment: formatMoment(moment),
      });
    } catch (err) {
      strapi.log.error('[fan-moment.active] Error:', err);
      return ctx.internalServerError('Failed to fetch active moment');
    }
  },

  /**
   * POST /api/fan-moments/shared
   * Record that a moment was shared
   */
  async shared(ctx) {
    try {
      const { momentId, bandId, visitorId, sessionId, channel } = ctx.request.body;

      if (!momentId) {
        return ctx.badRequest('Missing required field: momentId');
      }

      const now = new Date();

      await strapi.db.query('api::fan-moment.fan-moment').update({
        where: { id: momentId },
        data: {
          sharedAt: now.toISOString(),
          shareChannel: channel || 'unknown',
        },
      });

      return ctx.send({ ok: true });
    } catch (err) {
      strapi.log.error('[fan-moment.shared] Error:', err);
      return ctx.internalServerError('Failed to record share');
    }
  },
}));

/**
 * Format moment for API response
 */
function formatMoment(moment) {
  if (!moment) return null;

  const bandName = moment.band?.name || moment.context?.bandName || 'This Artist';

  return {
    id: String(moment.id),
    bandId: moment.band?.id || null,
    momentType: moment.momentType,
    createdAt: moment.createdAt,
    expiresAt: moment.expiresAt,
    context: {
      bandName,
      city: moment.context?.city || null,
      state: moment.context?.state || null,
      eventName: moment.context?.eventName || null,
      actionType: moment.actionType,
    },
    share: {
      title: moment.shareTitle || `I was there for ${bandName}`,
      text: moment.shareText || `I was part of the moment for ${bandName}! 🎵`,
      imageUrl: moment.shareImageUrl || null,
    },
  };
}
