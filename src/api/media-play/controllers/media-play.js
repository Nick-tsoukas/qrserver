'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::media-play.media-play',
  ({ strapi }) => ({
    // OVERRIDE GET /api/media-plays
    async find(ctx) {
      // pull through any filters or pagination from the querystring
      const { filters, pagination } = ctx.query;

      const entries = await strapi.entityService.findMany(
        'api::media-play.media-play',
        {
          filters: filters || {},
          populate: '*',
          pagination: pagination || {},
        }
      );

      return ctx.send({ data: entries });
    },

    // OVERRIDE GET /api/media-plays/:id
    async findOne(ctx) {
      const { id } = ctx.params;

      const entry = await strapi.entityService.findOne(
        'api::media-play.media-play',
        id,
        { populate: '*' }
      );

      if (!entry) {
        return ctx.notFound('Media Play not found');
      }

      return ctx.send({ data: entry });
    },

    // CUSTOM POST /api/media-plays/track
    async track(ctx) {
      const { bandId, mediaType, title } = ctx.request.body;

      if (!bandId || !mediaType || !title) {
        return ctx.badRequest('bandId, mediaType and title are required');
      }

      // make sure the band exists
      const band = await strapi.entityService.findOne('api::band.band', bandId);
      if (!band) {
        return ctx.notFound('Band not found');
      }

      // create the play record
      const created = await strapi.entityService.create(
        'api::media-play.media-play',
        {
          data: {
            band: bandId,
            mediaType,
            title,
            timestamp: new Date(),
          },
        }
      );

      return ctx.created({ data: created });
    },
  })
);
