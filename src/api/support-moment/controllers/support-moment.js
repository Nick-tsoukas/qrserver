'use strict';

/**
 * support-moment controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::support-moment.support-moment', ({ strapi }) => ({
  async summary(ctx) {
    const id = ctx.params.id;

    if (!id) return ctx.badRequest('Support moment id is required');

    const sm = await strapi.entityService.findOne('api::support-moment.support-moment', id, {
      fields: ['id', 'amount', 'currency', 'supportLabel', 'status'],
      publicationState: 'preview',
    });

    if (!sm) return ctx.notFound('Support moment not found');

    ctx.body = { data: sm };
  },
}));
