'use strict';
const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::band-insight-daily.band-insight-daily', {
  config: {
    find:    { auth: false }, // dev-only; lock later
    findOne: { auth: false },
  },
});
