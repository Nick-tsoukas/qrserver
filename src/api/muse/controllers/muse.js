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

      const [ytChannelRows, ytVideosRows, ytPlaylistsRows] = await Promise.all([
        strapi.entityService.findMany(
          "api::band-external-metric.band-external-metric",
          {
            filters: {
              band: { id: bandId },
              provider: "youtube",
              kind: "channel",
            },
            sort: ["date:desc", "id:desc"],
            limit: 1,
          }
        ),
        strapi.entityService.findMany(
          "api::band-external-metric.band-external-metric",
          {
            filters: {
              band: { id: bandId },
              provider: "youtube",
              kind: "videos",
            },
            sort: ["date:desc", "id:desc"],
            limit: 1,
          }
        ),
        strapi.entityService.findMany(
          "api::band-external-metric.band-external-metric",
          {
            filters: {
              band: { id: bandId },
              provider: "youtube",
              kind: "playlists",
            },
            sort: ["date:desc", "id:desc"],
            limit: 1,
          }
        ),
      ]);

      const channelRow = ytChannelRows && ytChannelRows.length ? ytChannelRows[0] : null;
      const videosRow = ytVideosRows && ytVideosRows.length ? ytVideosRows[0] : null;
      const playlistsRow = ytPlaylistsRows && ytPlaylistsRows.length ? ytPlaylistsRows[0] : null;

      let youtube = null;
      if (channelRow || videosRow || playlistsRow) {
        const channelNormalized = channelRow?.normalizedData || {};
        const channelRaw = channelRow?.raw || {};
        const videosRaw = videosRow?.raw || {};

        const dateCandidates = [
          channelRow?.syncedAt,
          videosRow?.syncedAt,
          playlistsRow?.syncedAt,
          channelRow?.createdAt,
          videosRow?.createdAt,
          playlistsRow?.createdAt,
        ].filter(Boolean);

        const date = dateCandidates.length
          ? dateCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : DateTime.utc().toISO();

        const recentVideos = [];

        const videoStats = Array.isArray(videosRaw.videoStats)
          ? videosRaw.videoStats
          : Array.isArray(videosRaw?.raw?.videoStats)
            ? videosRaw.raw.videoStats
            : [];

        const uploadsItems = Array.isArray(videosRaw.uploadsItems)
          ? videosRaw.uploadsItems
          : Array.isArray(videosRaw?.raw?.uploadsItems)
            ? videosRaw.raw.uploadsItems
            : [];

        if (Array.isArray(videoStats) && videoStats.length) {
          for (const v of videoStats) {
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
        } else if (Array.isArray(uploadsItems) && uploadsItems.length) {
          for (const v of uploadsItems) {
            recentVideos.push({
              videoId:
                v.contentDetails?.videoId ||
                v.snippet?.resourceId?.videoId ||
                null,
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
            channelNormalized.views ??
            channelNormalized.viewCount ??
            channelRaw.statistics?.viewCount ??
            0,
          subs:
            channelNormalized.subs ??
            channelNormalized.subscriberCount ??
            channelRaw.statistics?.subscriberCount ??
            0,
          videos:
            channelNormalized.videos ??
            channelNormalized.videoCount ??
            channelRaw.statistics?.videoCount ??
            (Array.isArray(recentVideos) ? recentVideos.length : 0),
          topVideo: recentVideos[0] || null,
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
