"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::link-click.link-click", ({ strapi }) => ({
  /**
   * Track a click for a specific band and platform.
   * Stores each click with a timestamp.
   * Public API (No authentication required).
   */
  async trackClick(ctx) {
    try {
      const { bandId, platform } = ctx.request.body;

      if (!bandId || !platform) {
        return ctx.badRequest("Missing bandId or platform");
      }

      // Check if the band exists
      const band = await strapi.entityService.findOne("api::band.band", bandId);
      if (!band) {
        return ctx.notFound("Band not found.");
      }

      // Create a new click event with a timestamp
      await strapi.entityService.create("api::link-click.link-click", {
        data: {
          band: bandId,
          platform,
          clickCount: 1, // Store each click separately
          timestamp: new Date(),
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
   * This is **publicly accessible** so anyone can see analytics.
   */
  async getBandClicks(ctx) {
    try {
      const { bandId } = ctx.params;

      // Check if the band exists
      const band = await strapi.entityService.findOne("api::band.band", bandId);
      if (!band) {
        return ctx.notFound("Band not found.");
      }

      // Fetch all click events for this band, sorted by timestamp (newest first)
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
