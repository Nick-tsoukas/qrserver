const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::band.band", ({ strapi }) => ({
  async find(ctx) {
    try {
      const filters = ctx.query.filters || {};
      const bands = await strapi.entityService.findMany("api::band.band", {
        filters,
        populate: {
          events: { populate: "image" },
          tours: { populate: "*" },
          albums: { populate: ["cover", "songs.file"] },
          singlesong: { populate: ["song", "cover"] }, // ✅ Ensures `song` file is included
          singlevideo: "*",
          bandImg: "*",
          users_permissions_user: { populate: ["username", "email"] },
          videos: { populate: "mediayoutube" },
          link_clicks: "*",
        },
      });

      return { data: bands };
    } catch (error) {
      console.error("Error fetching bands:", error);
      ctx.throw(500, "Internal Server Error");
    }
  },

  async findById(ctx) {
    try {
      const { id } = ctx.params;
      if (!id) return ctx.badRequest("ID parameter is required");

      const band = await strapi.entityService.findOne("api::band.band", id, {
        populate: {
          events: { populate: "image" },
          tours: { populate: "*" },
          albums: { populate: ["cover", "songs.file"] },
          singlesong: { populate: ["song", "cover"] }, // ✅ Ensures `song` file is included
          singlevideo: "*",
          bandImg: "*",
          users_permissions_user: { populate: ["username", "email"] },
          videos: { populate: "mediayoutube" },
          link_clicks: "*",
        },
      });

      if (!band) return ctx.notFound("Band not found");

      return { data: band };
    } catch (error) {
      console.error("Error fetching band by ID:", error);
      ctx.throw(500, "Internal Server Error");
    }
  },

  async findBySlug(ctx) {
    try {
      const { slug } = ctx.params;
      if (!slug) return ctx.badRequest("Slug parameter is required");

      const band = await strapi.entityService.findMany("api::band.band", {
        filters: { slug },
        populate: {
          events: { populate: "image" },
          tours: { populate: "*" },
          albums: { populate: ["cover", "songs.file"] },
          singlesong: { populate: ["song", "cover"] }, // ✅ Ensures `song` file is included
          singlevideo: "*",
          bandImg: "*",
          users_permissions_user: { populate: ["username", "email"] },
          videos: { populate: "mediayoutube" },
          link_clicks: "*",
        },
      });

      if (!band || band.length === 0) return ctx.notFound("Band not found");

      return { data: band[0] }; // Return the first match
    } catch (error) {
      console.error("Error fetching band by slug:", error);
      ctx.throw(500, "Internal Server Error");
    }
  },
}));
