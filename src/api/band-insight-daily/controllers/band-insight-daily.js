'use strict';
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::band-insight-daily.band-insight-daily', ({ strapi }) => ({

  // GET /band-insights-daily/compute?bandId=1&day=YYYY-MM-DD
  async compute(ctx) {
    const bandId = Number(ctx.query.bandId || ctx.query.band_id);
    const day = ctx.query.day;
    if (!bandId) return ctx.badRequest('Missing bandId');
    try {
      const result = await strapi
        .service('api::band-insight-daily.band-insight-daily')
        .computeDay({ bandId, day });
      ctx.body = { ok: true, result };
    } catch (err) {
      strapi.log.error('compute error', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: String(err?.message || err) };
    }
  },

  async debug(ctx) {
  ctx.body = {
    path: ctx.request.path,
    query: ctx.query,
    raw: ctx.request.querystring,
  };
},

// controllers/band-insight-daily.js
async insights(ctx) {
  const bandId = Number(ctx.query.bandId);
  if (!bandId) return ctx.badRequest('Missing bandId');
  try {
    const list = await strapi
      .service('api::band-insight-daily.band-insight-daily')
      .generateMuse({ bandId, days: 30 });
    ctx.body = { ok: true, data: list };
  } catch (e) {
    ctx.status = 500; ctx.body = { ok: false, error: String(e?.message || e) };
  }
},


  // GET /muse?bandId=1&day=YYYY-MM-DD
  async muse(ctx) {
    const bandId = Number(ctx.query.bandId || ctx.query.band_id);
    const day = ctx.query.day;
    if (!bandId) return ctx.badRequest('Missing bandId');
    try {
      const result = await strapi
        .service('api::band-insight-daily.band-insight-daily')
        .computeDay({ bandId, day });
      ctx.body = { ok: true, result };
    } catch (err) {
      strapi.log.error('muse error', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: String(err?.message || err) };
    }
  },

    // NEW: /muse/backfill?bandId=1&days=14  (days defaults to 1 = today only)
  async backfill(ctx) {
    const bandId = Number(ctx.query.bandId || ctx.query.band_id);
    const days = Math.max(1, Number(ctx.query.days || 1));
    if (!bandId) return ctx.badRequest('Missing bandId');

    const svc = strapi.service('api::band-insight-daily.band-insight-daily');
    const today = new Date();
    const results = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      d.setUTCDate(d.getUTCDate() - i);
      try {
        const r = await svc.computeDay({ bandId, day: d.toISOString().slice(0,10) });
        results.push({ day: d.toISOString().slice(0,10), ok: true, id: r?.id });
      } catch (e) {
        results.push({ day: d.toISOString().slice(0,10), ok: false, error: String(e?.message || e) });
      }
    }

    ctx.body = { ok: true, count: results.length, results };
  },

  // GET /muse/insights?bandId=1 - V2 insights with confidence, why, actions
  async insightsV2(ctx) {
    const bandId = Number(ctx.query.bandId || ctx.query.band_id);
    const days = Number(ctx.query.days || 30);
    if (!bandId) return ctx.badRequest('Missing bandId');

    try {
      const result = await strapi
        .service('api::band-insight-daily.band-insight-daily')
        .generateInsightsV2({ bandId, days });
      ctx.body = result;
    } catch (err) {
      strapi.log.error('[insightsV2] error', err);
      ctx.status = 500;
      ctx.body = { ok: false, error: String(err?.message || err) };
    }
  },

}));
