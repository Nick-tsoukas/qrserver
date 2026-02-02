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
      // Get QR with band populated (full)
      const qrFull = await strapi.entityService.findOne('api::qr.qr', id, {
        populate: ['band'],
      });
      
      // Try with only specific band fields (no media)
      const qrMinimal = await strapi.entityService.findOne('api::qr.qr', id, {
        populate: {
          band: {
            fields: ['id', 'slug', 'name'],
          },
        },
      });
      
      // Also try raw query
      const raw = await strapi.db.query('api::qr.qr').findOne({
        where: { id },
        populate: ['band'],
      });
      
      return {
        entityServiceFull: {
          id: qrFull?.id,
          band: qrFull?.band || null,
        },
        entityServiceMinimal: {
          id: qrMinimal?.id,
          band: qrMinimal?.band || null,
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

  // Lookup endpoint that bypasses entityService permission sanitization
  // Uses db.query directly to get the band relation
  async lookup(ctx) {
    const { url, id } = ctx.query;
    
    try {
      let qr = null;
      
      // Try by URL first
      if (url) {
        qr = await strapi.db.query('api::qr.qr').findOne({
          where: { url },
          populate: ['band', 'event'],
        });
      }
      
      // Try by slugId field directly (most reliable for UUID-based lookups)
      if (!qr && id) {
        qr = await strapi.db.query('api::qr.qr').findOne({
          where: { slugId: id },
          populate: ['band', 'event'],
        });
      }
      
      // Try by numeric Strapi ID
      if (!qr && id && /^\d+$/.test(id)) {
        qr = await strapi.db.query('api::qr.qr').findOne({
          where: { id: parseInt(id, 10) },
          populate: ['band', 'event'],
        });
      }
      
      // Last resort: search options.data for the id
      if (!qr && id) {
        const all = await strapi.db.query('api::qr.qr').findMany({
          populate: ['band', 'event'],
        });
        qr = all.find(q => q.options?.data?.includes(id));
      }
      
      if (!qr) {
        return ctx.notFound('QR not found');
      }
      
      // Return minimal data needed for redirect
      return {
        data: {
          id: qr.id,
          q_type: qr.q_type,
          link: qr.link,
          arEnabled: qr.arEnabled,
          template: qr.template,
          band: qr.band ? {
            id: qr.band.id,
            slug: qr.band.slug,
            name: qr.band.name,
          } : null,
          event: qr.event ? {
            id: qr.event.id,
            slug: qr.event.slug,
          } : null,
        },
      };
    } catch (error) {
      strapi.log.error('QR lookup error:', error);
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
