"use strict";
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::media-play.media-play", ({ strapi }) => ({
  async track(ctx) {
    const { bandId, mediaType, title } = ctx.request.body;
    if (!bandId || !mediaType || !title) {
      return ctx.badRequest("bandId, mediaType and title are required");
    }
    const band = await strapi.entityService.findOne("api::band.band", bandId);
    if (!band) {
      return ctx.notFound("Band not found");
    }
    await strapi.entityService.create("api::media-play.media-play", {
      data: {
        band: bandId,
        mediaType,
        title,
        timestamp: new Date()
      },
    });
    return ctx.send({ message: "Play tracked" });
  }
}));
