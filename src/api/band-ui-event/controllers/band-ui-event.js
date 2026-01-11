'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::band-ui-event.band-ui-event',
  ({ strapi }) => ({
    /**
     * POST /band-ui-events/track
     * Track an anonymous UI event for a band (e.g., follow modal interactions).
     * No personal data is stored.
     */
    async track(ctx) {
      try {
        const { bandId, bandSlug, eventName, payload } = ctx.request.body;

        if (!eventName) {
          return ctx.badRequest('Missing eventName');
        }

        // bandId is optional but preferred
        let bandRef = null;
        if (bandId) {
          const band = await strapi.entityService.findOne('api::band.band', bandId);
          if (band) {
            bandRef = bandId;
          }
        }

        // Create the event record
        const created = await strapi.entityService.create(
          'api::band-ui-event.band-ui-event',
          {
            data: {
              band: bandRef,
              bandSlug: bandSlug || null,
              eventName,
              payload: payload || {},
              timestamp: new Date(),
            },
          }
        );

        return ctx.send({ ok: true, id: created.id });
      } catch (error) {
        strapi.log.error('Error tracking UI event:', error);
        return ctx.throw(500, 'Internal server error');
      }
    },
  })
);
