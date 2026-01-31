'use strict';

/**
 * qr controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::qr.qr', ({ strapi }) => ({
  // Debug endpoint to see what's stored for a QR's band relation
  async debugBand(ctx) {
    const { id } = ctx.params;
    
    try {
      // Get QR with band populated
      const qr = await strapi.entityService.findOne('api::qr.qr', id, {
        populate: ['band'],
      });
      
      // Also try raw query
      const raw = await strapi.db.query('api::qr.qr').findOne({
        where: { id },
        populate: ['band'],
      });
      
      return {
        entityService: {
          id: qr?.id,
          band: qr?.band || null,
        },
        dbQuery: {
          id: raw?.id,
          band: raw?.band || null,
        },
      };
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Fix endpoint to properly set the band relation
  async fixBand(ctx) {
    const { id, bandId } = ctx.params;
    
    try {
      // Update using entityService
      const updated = await strapi.entityService.update('api::qr.qr', id, {
        data: {
          band: parseInt(bandId, 10),
        },
        populate: ['band'],
      });
      
      return {
        success: true,
        qrId: updated.id,
        band: updated.band || null,
      };
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Custom find that allows filtering by users_permissions_user
  async find(ctx) {
    // Extract user filter from query
    const userId = ctx.query?.filters?.users_permissions_user?.id?.['$eq'];
    
    if (userId) {
      // Use entityService directly to bypass query parameter validation
      const { fields, populate, sort, pagination } = ctx.query;
      
      const results = await strapi.entityService.findMany('api::qr.qr', {
        filters: { users_permissions_user: { id: userId } },
        fields: fields || undefined,
        populate: populate || undefined,
        sort: sort || undefined,
        start: pagination?.start || 0,
        limit: pagination?.pageSize || 25,
      });
      
      const total = await strapi.entityService.count('api::qr.qr', {
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
