'use strict';

/**
 * Shareables Controller
 * GET /api/pulse/shareables?bandId=123
 */

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
};
