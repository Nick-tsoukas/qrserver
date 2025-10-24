'use strict';

const { addDays, startOfDay, subDays } = require('date-fns');
const { createStrapi } = require('@strapi/strapi');

(async () => {
  const app = await createStrapi().load();
  try {
    const bands = await strapi.entityService.findMany('api::band.band', { fields: ['id'] });
    const service = strapi.service('api::band-insight-daily.rollup');

    // backfill last 30 days
    const today = startOfDay(new Date());
    const start = subDays(today, 30);

    for (const band of bands) {
      let d = start;
      while (d < today) {
        // eslint-disable-next-line no-await-in-loop
        await service.computeDay({ bandId: band.id, day: d });
        d = addDays(d, 1);
      }
    }
    console.log('✅ Backfill complete');
  } catch (e) {
    console.error('❌ Backfill error', e);
  } finally {
    await app.destroy();
    process.exit(0);
  }
})();
