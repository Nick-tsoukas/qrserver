'use strict';

const { DateTime } = require('luxon');
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::band-external-metric.band-external-metric',
  ({ strapi }) => ({
    // POST /api/band-external-metrics/upsert
    async upsert(ctx) {
      try {
        const { bandId, provider, date, normalizedData } = ctx.request.body || {};

        if (!bandId) return ctx.badRequest('bandId required');
        if (!provider) return ctx.badRequest('provider required');

        // default to today (UTC)
        const day = date ? date : DateTime.utc().toISODate();

        // check if it already exists
        const existing = await strapi.entityService.findMany(
          'api::band-external-metric.band-external-metric',
          {
            filters: {
              band: bandId,
              provider,
              date: day,
            },
            fields: ['id'],
            pagination: { limit: 1 },
          }
        );

        const data = {
          band: bandId,
          provider,
          date: day,
          normalizedData: normalizedData ?? null,
          syncedAt: new Date().toISOString(),
        };

        let saved;
        if (existing && existing.length) {
          saved = await strapi.entityService.update(
            'api::band-external-metric.band-external-metric',
            existing[0].id,
            { data }
          );
        } else {
          saved = await strapi.entityService.create(
            'api::band-external-metric.band-external-metric',
            { data }
          );
        }

        ctx.body = { ok: true, data: saved };
      } catch (err) {
        strapi.log.error('[band-external-metric.upsert]', err);
        ctx.status = 500;
        ctx.body = { ok: false, error: err.message || 'Internal error' };
      }
    },

    // GET /api/band-external-metrics/latest?bandId=1&provider=youtube
    async latest(ctx) {
      try {
        const bandId = Number(ctx.request.query.bandId);
        const provider = String(ctx.request.query.provider || '').trim();

        if (!bandId) return ctx.badRequest('bandId required');
        if (!provider) return ctx.badRequest('provider required');

        const rows = await strapi.entityService.findMany(
          'api::band-external-metric.band-external-metric',
          {
            filters: {
              band: bandId,
              provider,
            },
            sort: ['date:desc', 'createdAt:desc'],
            pagination: { limit: 1 },
            populate: { band: true },
          }
        );

        ctx.body = {
          ok: true,
          data: rows[0] || null,
        };
      } catch (err) {
        strapi.log.error('[band-external-metric.latest]', err);
        ctx.status = 500;
        ctx.body = { ok: false, error: err.message || 'Internal error' };
      }
    },
  })
);
