"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::link-click.link-click", ({ strapi }) => ({
  /**
   * Track a click for a specific band and platform.
   */
  async trackClick(ctx) {
    try {
      const { bandId, platform } = ctx.request.body;
      if (!bandId || !platform) {
        return ctx.badRequest("Missing bandId or platform");
      }

      // Verify that the band exists
      const band = await strapi.entityService.findOne("api::band.band", bandId);
      if (!band) {
        return ctx.notFound("Band not found.");
      }

      // Create a new click event
      await strapi.entityService.create("api::link-click.link-click", {
        data: {
          band: bandId,
          platform,
          clickCount: 1, // Each click is stored individually
          timestamp: new Date(),
          publishedAt: new Date()
        },
      });

      return ctx.send({ message: "Click tracked successfully." });
    } catch (error) {
      strapi.log.error("Error tracking click:", error);
      return ctx.throw(500, "Internal server error");
    }
  },

  /**
   * Get all link clicks for a specific band.
   */
  async getBandClicks(ctx) {
    try {
      const { bandId } = ctx.params;
      const band = await strapi.entityService.findOne("api::band.band", bandId);
      if (!band) {
        return ctx.notFound("Band not found.");
      }

      const clicks = await strapi.entityService.findMany("api::link-click.link-click", {
        filters: { band: bandId },
        sort: [{ timestamp: "desc" }],
      });

      return ctx.send(clicks);
    } catch (error) {
      strapi.log.error("Error fetching band analytics:", error);
      return ctx.throw(500, "Internal server error");
    }
  },
}));
