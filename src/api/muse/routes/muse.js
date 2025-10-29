'use strict';

module.exports = {
  routes: [
    // Compute one day for one band; upsert band-insights-daily
    { method: 'POST', path: '/muse/run', handler: 'api::muse.muse.run', config: { auth: false } },

    // Backfill inclusive date range YYYY-MM-DD..YYYY-MM-DD
    { method: 'POST', path: '/muse/backfill', handler: 'api::muse.muse.backfill', config: { auth: false } },

    // Phase 2 aggregate summaries (7d / 30d / 365d)
    { method: 'GET', path: '/muse/aggregate', handler: 'api::muse.muse.aggregate', config: { auth: false } },
  ],
};
