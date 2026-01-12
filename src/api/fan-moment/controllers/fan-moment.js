'use strict';

/**
 * fan-moment controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

/**
 * Validate cron key for protected endpoints
 * @param {object} ctx - Koa context
 * @returns {object} { authorized: boolean, error?: string }
 */
function validateCronKey(ctx) {
  const cronKey = ctx.request.headers['x-mbq-cron-key'];
  const expectedKey = process.env.MBQ_CRON_KEY;
  
  // In production, MBQ_CRON_KEY must be set
  if (!expectedKey) {
    // Allow in dev mode (no key set), but log warning
    if (process.env.NODE_ENV === 'production') {
      return { authorized: false, error: 'MBQ_CRON_KEY not configured on server' };
    }
    // Dev mode: allow without key
    return { authorized: true };
  }
  
  // Key is set, must match
  if (!cronKey) {
    return { authorized: false, error: 'Missing x-mbq-cron-key header' };
  }
  
  if (cronKey !== expectedKey) {
    return { authorized: false, error: 'Invalid cron key' };
  }
  
  return { authorized: true };
}

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

      const momentTemplates = require('../services/momentTemplates');
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

      // Calculate fan position (how many fans before this one)
      const fanPosition = await momentTemplates.calculateFanPosition(strapi, bandId, 'day');
      
      // Check for milestone achievements
      const milestone = await momentTemplates.checkMilestone(strapi, bandId);

      // Determine moment type based on action and pulse
      let momentType = 'I_WAS_THERE';
      
      // Upgrade to FUELED_MOMENTUM for payments, milestones, or if pulse is warming/surging
      if (actionType === 'payment') {
        momentType = 'FUELED_MOMENTUM';
      } else if (milestone) {
        momentType = 'FUELED_MOMENTUM';
      } else if (actionType === 'follow' && pulse) {
        const state = pulse.momentumState || pulse.state;
        if (state === 'warming' || state === 'surging') {
          momentType = 'FUELED_MOMENTUM';
        }
      }

      // Build rich context for template interpolation
      const templateContext = {
        bandName: band.name || 'This Artist',
        bandSlug: band.slug,
        city: context?.city || null,
        state: context?.state || null,
        eventName: context?.eventName || null,
        actionType,
        fanPosition,
        milestone: milestone?.label || null,
        velocity: pulse?.velocity || null,
        recentInteractions: pulse?.recentInteractions || null,
      };

      // Generate rich share content using templates
      const shareContent = momentTemplates.generateMomentContent(momentType, actionType, templateContext);
      const triggerReason = momentTemplates.getTriggerReason(momentType, actionType, templateContext);

      // Build stored context
      const momentContext = {
        ...templateContext,
        landingPath: context?.landingPath || null,
        sourceCategory: context?.sourceCategory || null,
      };

      // Create the moment with rich content
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
          triggerReason,
          milestone: milestone || null,
          fanPosition,
          shareTitle: shareContent.shareTitle,
          shareText: shareContent.shareText,
          shareSubtitle: shareContent.shareSubtitle,
          shareEmoji: shareContent.shareEmoji,
          shareCallToAction: shareContent.shareCallToAction,
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

  /**
   * POST /api/fan-moments/evaluate-auto
   * Evaluate bands for auto-moment creation
   * Protected by x-mbq-cron-key header
   */
  async evaluateAuto(ctx) {
    try {
      // Validate cron key
      const authResult = validateCronKey(ctx);
      if (!authResult.authorized) {
        strapi.log.warn('[CRON evaluate-auto] Unauthorized attempt');
        return ctx.unauthorized(authResult.error);
      }

      const { bandId, dryRun = false } = ctx.request.body || {};
      const autoMomentService = require('../services/autoMoment');

      let result;

      if (bandId) {
        // Evaluate single band
        const evalResult = await autoMomentService.evaluateBand(strapi, Number(bandId), dryRun);
        result = {
          ok: true,
          evaluated: 1,
          created: evalResult.created ? 1 : 0,
          createdMoments: evalResult.created ? [{
            bandId: evalResult.bandId,
            momentType: evalResult.momentType,
            context: evalResult.context,
          }] : [],
          details: evalResult,
        };
      } else {
        // Evaluate all bands with recent activity
        result = await autoMomentService.evaluateAllBands(strapi, dryRun);
        result.ok = true;
      }

      strapi.log.info(`[CRON evaluate-auto] ok: evaluated=${result.evaluated} created=${result.created}`);
      return ctx.send(result);
    } catch (err) {
      strapi.log.error('[fan-moment.evaluateAuto] Error:', err);
      return ctx.internalServerError('Failed to evaluate auto-moments');
    }
  },

  /**
   * GET /api/fan-moments/auto-active?bandId=...
   * Get active AUTO moment for a band (band-facing)
   */
  async autoActive(ctx) {
    try {
      const { bandId } = ctx.query;

      if (!bandId) {
        return ctx.badRequest('Missing required query param: bandId');
      }

      const autoMomentService = require('../services/autoMoment');
      const moment = await autoMomentService.getActiveAutoMoment(strapi, Number(bandId));

      return ctx.send({
        ok: true,
        moment,
      });
    } catch (err) {
      strapi.log.error('[fan-moment.autoActive] Error:', err);
      return ctx.internalServerError('Failed to fetch auto-active moment');
    }
  },

  /**
   * POST /api/fan-moments/evaluate-recap
   * Evaluate bands for after-show recap creation
   * Protected by x-mbq-cron-key header
   */
  async evaluateRecap(ctx) {
    try {
      // Validate cron key
      const authResult = validateCronKey(ctx);
      if (!authResult.authorized) {
        strapi.log.warn('[CRON evaluate-recap] Unauthorized attempt');
        return ctx.unauthorized(authResult.error);
      }

      const { bandId, dryRun = false } = ctx.request.body || {};
      const recapMomentService = require('../services/recapMoment');

      let result;

      if (bandId) {
        const evalResult = await recapMomentService.evaluateBand(strapi, Number(bandId), dryRun);
        result = {
          ok: true,
          evaluated: 1,
          created: evalResult.created ? 1 : 0,
          createdMoments: evalResult.created ? [{
            bandId: evalResult.bandId,
            momentType: evalResult.momentType,
            context: evalResult.context,
          }] : [],
          details: evalResult,
        };
      } else {
        result = await recapMomentService.evaluateAllBands(strapi, dryRun);
        result.ok = true;
      }

      strapi.log.info(`[CRON evaluate-recap] ok: evaluated=${result.evaluated} created=${result.created}`);
      return ctx.send(result);
    } catch (err) {
      strapi.log.error('[fan-moment.evaluateRecap] Error:', err);
      return ctx.internalServerError('Failed to evaluate recaps');
    }
  },

  /**
   * GET /api/fan-moments/recap-active?bandId=...
   * Get active AFTER_SHOW_RECAP moment for a band
   */
  async recapActive(ctx) {
    try {
      const { bandId } = ctx.query;

      if (!bandId) {
        return ctx.badRequest('Missing required query param: bandId');
      }

      const recapMomentService = require('../services/recapMoment');
      const recap = await recapMomentService.getActiveRecap(strapi, Number(bandId));

      return ctx.send({
        ok: true,
        recap,
      });
    } catch (err) {
      strapi.log.error('[fan-moment.recapActive] Error:', err);
      return ctx.internalServerError('Failed to fetch active recap');
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
    actionType: moment.actionType,
    createdAt: moment.createdAt,
    expiresAt: moment.expiresAt,
    triggerReason: moment.triggerReason || null,
    fanPosition: moment.fanPosition || null,
    milestone: moment.milestone || null,
    context: {
      bandName,
      bandSlug: moment.context?.bandSlug || moment.band?.slug || null,
      city: moment.context?.city || null,
      state: moment.context?.state || null,
      eventName: moment.context?.eventName || null,
      actionType: moment.actionType,
      velocity: moment.context?.velocity || null,
      recentInteractions: moment.context?.recentInteractions || null,
      cityName: moment.context?.cityName || null,
      cityInteractions: moment.context?.cityInteractions || null,
    },
    share: {
      title: moment.shareTitle || `I was there for ${bandName}`,
      subtitle: moment.shareSubtitle || null,
      text: moment.shareText || `I was part of the moment for ${bandName}! 🎵`,
      emoji: moment.shareEmoji || '✨',
      callToAction: moment.shareCallToAction || 'Check them out',
      imageUrl: moment.shareImageUrl || null,
    },
  };
}
