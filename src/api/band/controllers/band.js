const { parseMultipartData } = require('@strapi/utils');
const { createCoreController } = require('@strapi/strapi').factories;

const populateOptions = {
  events: { populate: "image" },
  tours: { populate: "*" },
  albums: { populate: ["cover", "songs.file"] },
  singlesong: { populate: ["song", "cover"] },
  singlevideo: "*",
  bandImg: "*",
  users_permissions_user: { populate: ["username", "email"] },
  videos: { populate: "mediayoutube" },
  link_clicks: "*",
};

module.exports = createCoreController("api::band.band", ({ strapi }) => ({
  async find(ctx) {
    try {
      const filters = ctx.query.filters || {};
      const bands = await strapi.entityService.findMany("api::band.band", {
        filters,
        populate: populateOptions,
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
        populate: populateOptions,
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
        populate: populateOptions,
      });
      if (!band || band.length === 0) return ctx.notFound("Band not found");
      return { data: band[0] }; // Return the first match
    } catch (error) {
      console.error("Error fetching band by slug:", error);
      ctx.throw(500, "Internal Server Error");
    }
  },

  // POST method to create a new band
  async create(ctx) {
    try {
      const isMultipart = ctx.is("multipart");
      let data, files;
      
      if (isMultipart) {
        const parsed = await parseMultipartData(ctx);
        // If parsed.data is a string, then parse it into an object.
        data = typeof parsed.data === "string" ? JSON.parse(parsed.data) : parsed.data;
        files = parsed.files;
        console.log("💡 Parsed multipart data:", data);
        console.log("📦 Parsed multipart files:", files);
      } else {
        data = ctx.request.body.data;
        console.log("💡 JSON data:", data);
      }
      
      // Safety check: Ensure required fields are present.
      if (!data?.name || !data?.genre || !data?.bio) {
        console.warn("❌ Missing required fields:", data);
        return ctx.badRequest("Missing required fields: name, genre, bio.");
      }
      
      const createdBand = await strapi.entityService.create("api::band.band", {
        data,
        files: files || undefined,
        populate: populateOptions,
      });
      
      return { data: createdBand };
    } catch (error) {
      console.error("🔥 Error in band creation:", error);
      // Ensure error message is a string
      const errMsg = typeof error.message === "object" ? JSON.stringify(error.message) : error.message;
      ctx.throw(500, "Internal Server Error: " + errMsg);
    }
  },
// del
  async delete(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Missing `id` parameter');
    try {
      // remove the record
      const deleted = await strapi.entityService.delete('api::band.band', id);
      return { data: deleted };
    } catch (err) {
      console.error('Error deleting band:', err);
      ctx.throw(500, 'Internal Server Error');
    }
  },

  // PUT method to update an existing band
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      if (!id) {
        return ctx.badRequest("ID parameter is required");
      }
      const existingBand = await strapi.entityService.findOne("api::band.band", id);
      if (!existingBand) {
        return ctx.notFound("Band not found");
      }
      if (!data?.name || !data?.genre || !data?.bio) {
        return ctx.badRequest("Missing required fields: name, genre, bio.");
      }
      const updatedBand = await strapi.entityService.update("api::band.band", id, {
        data,
        populate: populateOptions,
      });
      return { data: updatedBand };
    } catch (error) {
      console.error("🔥 Error updating band:", error);
      ctx.throw(500, "Internal Server Error: " + error.message);
    }
  },
}));
