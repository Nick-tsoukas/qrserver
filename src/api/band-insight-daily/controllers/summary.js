'use strict';

module.exports = {
  async summary(ctx) {
    const { bandId, range = '7d' } = ctx.request.query;
    if (!bandId) return ctx.badRequest('bandId required');

    const svc = strapi.service('api::band-insight-daily.band-insight-daily');
    const today = new Date().toISOString().slice(0, 10);

    // Always recompute today’s rollup before returning summary
    await svc.computeDay({ bandId: Number(bandId), day: today });

    // Then aggregate the requested range
    const data = await svc.aggregateSummary({ bandId: Number(bandId), range });
    ctx.body = data;
  },
};
