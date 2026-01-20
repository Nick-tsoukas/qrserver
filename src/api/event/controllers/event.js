'use strict';

/**
 * event controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => ({
  // Custom find that allows filtering by users_permissions_user
  async find(ctx) {
    // Extract user filter from query
    const userId = ctx.query?.filters?.users_permissions_user?.id?.['$eq'];
    
    if (userId) {
      // Use entityService directly to bypass query parameter validation
      const { fields, populate, sort, pagination } = ctx.query;
      
      const results = await strapi.entityService.findMany('api::event.event', {
        filters: { users_permissions_user: { id: userId } },
        fields: fields || undefined,
        populate: populate || undefined,
        sort: sort || undefined,
        start: pagination?.start || 0,
        limit: pagination?.pageSize || 25,
      });
      
      const total = await strapi.entityService.count('api::event.event', {
        filters: { users_permissions_user: { id: userId } },
      });
      
      return {
        data: results,
        meta: {
          pagination: {
            page: 1,
            pageSize: pagination?.pageSize || 25,
            pageCount: Math.ceil(total / (pagination?.pageSize || 25)),
            total,
          },
        },
      };
    }
    
    // Fall back to default find for other queries
    return await super.find(ctx);
  },
}));
