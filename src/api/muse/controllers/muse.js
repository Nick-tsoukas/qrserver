'use strict';

const museService = require('../services/muse');

module.exports = {
  async run(ctx) {
    try {
      const bandId = Number(ctx.request.query.bandId || ctx.request.body?.bandId);
      const day    = String(ctx.request.query.day || ctx.request.body?.day || '').trim();
      if (!bandId) return ctx.badRequest('bandId required');

      const result = await museService().computeDay({ bandId, day: day || undefined });
      ctx.body = { ok: true, result };
    } catch (err) {
      strapi.log.error('[muse.run]', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || 'Internal Error' };
    }
  },

  async backfill(ctx) {
    try {
      const bandId = Number(ctx.request.query.bandId || ctx.request.body?.bandId);
      const from   = String(ctx.request.query.from || ctx.request.body?.from || '').trim();
      const to     = String(ctx.request.query.to   || ctx.request.body?.to   || '').trim();
      if (!bandId || !from || !to) return ctx.badRequest('bandId, from, to required');

      const out = await museService().backfillRange({ bandId, from, to });
      ctx.body = { ok: true, ...out };
    } catch (err) {
      strapi.log.error('[muse.backfill]', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || 'Internal Error' };
    }
  },

  // 🔥 NEW — aggregate summaries
  async aggregate(ctx) {
    try {
      const bandId = Number(ctx.request.query.bandId || ctx.request.body?.bandId);
      const range  = String(ctx.request.query.range || ctx.request.body?.range || '7d');
      if (!bandId) return ctx.badRequest('bandId required');

      const result = await museService().aggregateSummary({ bandId, range });
      ctx.body = { ok: true, ...result };
    } catch (err) {
      strapi.log.error('[muse.aggregate]', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || 'Internal Error' };
    }
  },
};
