"use strict";

const { DateTime } = require("luxon");

module.exports = {
  // POST /api/muse/run
  async run(ctx) {
    const bandId = Number(ctx.request.body?.bandId || ctx.request.query?.bandId);
    const day = ctx.request.body?.day || ctx.request.query?.day || DateTime.utc().toISODate();

    // for now just echo — you can plug your real recompute logic later
    ctx.body = {
      ok: true,
      message: "muse.run hit",
      bandId: bandId || null,
      day,
    };
  },

  // POST /api/muse/backfill
  async backfill(ctx) {
    ctx.body = {
      ok: true,
      message: "muse.backfill hit (stub)",
    };
  },

  // GET /api/muse/aggregate?bandId=5&range=30d
  async aggregate(ctx) {
    try {
      const bandId = Number(ctx.request.query.bandId || ctx.request.body?.bandId);
      const range = String(ctx.request.query.range || "30d");
      if (!bandId) return ctx.badRequest("bandId required");

      // 1) try to reuse your existing analytics controller
      let analyticsRes = {};
      try {
        analyticsRes = await strapi.controller("api::analytics.analytics").rollups(ctx);
      } catch (err) {
        strapi.log.warn("[muse.aggregate] analytics.rollups failed", err);
        analyticsRes = { ok: true, totals: {}, series: [] };
      }

      // 2) pull external youtube (from band-external-metric) – latest only
      const ytRows = await strapi.entityService.findMany(
        "api::band-external-metric.band-external-metric",
        {
          filters: {
            band: { id: bandId },
            provider: "youtube",
          },
          sort: ["date:desc", "id:desc"],
          limit: 1,
        }
      );

      let youtube = null;
      if (ytRows && ytRows.length) {
        const row = ytRows[0];
        const normalized = row.normalizedData || {};
        const raw = row.raw || {};
        const date = row.date || row.createdAt || DateTime.utc().toISO();

        const recentVideos = [];

        // prefer raw.videoStats
        if (Array.isArray(raw.videoStats) && raw.videoStats.length) {
          for (const v of raw.videoStats) {
            recentVideos.push({
              videoId: v.id,
              title: v.snippet?.title || "",
              views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : 0,
              publishedAt: v.snippet?.publishedAt || null,
              thumbnail:
                v.snippet?.thumbnails?.medium?.url ||
                v.snippet?.thumbnails?.high?.url ||
                v.snippet?.thumbnails?.default?.url ||
                null,
            });
          }
        } else if (Array.isArray(raw.uploadsItems) && raw.uploadsItems.length) {
          for (const v of raw.uploadsItems) {
            recentVideos.push({
              videoId: v.contentDetails?.videoId || v.snippet?.resourceId?.videoId || null,
              title: v.snippet?.title || "",
              views: 0,
              publishedAt: v.snippet?.publishedAt || null,
              thumbnail:
                v.snippet?.thumbnails?.medium?.url ||
                v.snippet?.thumbnails?.high?.url ||
                v.snippet?.thumbnails?.default?.url ||
                null,
            });
          }
        }

        youtube = {
          connected: true,
          date,
          views:
            normalized.views ??
            normalized.viewCount ??
            raw.statistics?.viewCount ??
            0,
          subs:
            normalized.subs ??
            normalized.subscriberCount ??
            raw.statistics?.subscriberCount ??
            0,
          videos:
            normalized.videos ??
            normalized.videoCount ??
            (Array.isArray(recentVideos) ? recentVideos.length : 0),
          topVideo: normalized.topVideo || recentVideos[0] || null,
          recentVideos,
        };
      }

      // 3) recent muse rows (optional)
      const museRows = await strapi.entityService.findMany(
        "api::band-insight-daily.band-insight-daily",
        {
          filters: { band: { id: bandId } },
          sort: ["date:desc"],
          limit: 7,
        }
      );

      ctx.body = {
        ok: true,
        bandId,
        range,
        ...analyticsRes,
        external: {
          youtube,
        },
        muse: museRows,
      };
    } catch (err) {
      strapi.log.error("[muse.aggregate] error", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err.message };
    }
  },
};
