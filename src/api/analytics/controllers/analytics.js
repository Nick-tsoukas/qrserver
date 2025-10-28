"use strict";

const { DateTime } = require("luxon");

const uidPV = "api::band-page-view.band-page-view";
const uidLC = "api::link-click.link-click";
const uidMP = "api::media-play.media-play";

const fieldTS = "timestamp"; // explicit datetime in your schemas
const safeInt = (n) => (Number.isFinite(n) ? n : 0);

module.exports = {
  async rollups(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      if (!bandId) return ctx.badRequest("bandId required");

      const range = String(ctx.query.range || "30d"); // "1d" | "7d" | "30d" | "365d"
      const days = Number(range.replace("d", "")) || 30;

      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      // Common filters
      const filters = {
        band: { id: bandId },
        [fieldTS]: { $gte: from, $lte: to },
      };

      // ---------- PAGE VIEWS ----------
      const pvRows = await strapi.entityService.findMany(uidPV, {
        filters,
        fields: ["id", "userAgent", "refDomain", "refSource", "refMedium", "city", fieldTS],
        pagination: { limit: 100000 },
      });

      const by = (rows, pick) =>
        rows.reduce((m, r) => {
          const raw = pick(r);
          const k = (raw || "unknown").toString().toLowerCase();
          m[k] = (m[k] || 0) + 1;
          return m;
        }, {});

      const sources = Object.entries(by(pvRows, (r) => r.refSource)).sort((a, b) => b[1] - a[1]);
      const mediums = Object.entries(by(pvRows, (r) => r.refMedium)).sort((a, b) => b[1] - a[1]);
      const refDomains = Object.entries(by(pvRows, (r) => r.refDomain))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const deviceOf = (ua = "") => {
        const s = String(ua).toLowerCase();
        if (!s) return "unknown";
        if (/bot|crawl|spider|slurp|headless|preview/.test(s)) return "bot";
        if (/ipad|tablet/.test(s)) return "tablet";
        if (/android/.test(s) && !/mobile/.test(s)) return "tablet";
        if (/mobile|iphone|ipod|android.*mobile/.test(s)) return "mobile";
        return "desktop";
      };
      const devices = pvRows.reduce(
        (m, r) => {
          const k = deviceOf(r.userAgent);
          m[k] = (m[k] || 0) + 1;
          return m;
        },
        { desktop: 0, mobile: 0, tablet: 0, bot: 0, unknown: 0 }
      );

      // ---------- LINK CLICKS ----------
   const lcRows = await strapi.entityService.findMany(uidLC, {
   filters,
   fields: ["id", "platform", fieldTS], // url removed
  pagination: { limit: 100000 },
 });
      const platforms = Object.entries(
        lcRows.reduce((m, r) => {
          const k = (r.platform || "unknown").toString().toLowerCase();
          m[k] = (m[k] || 0) + 1;
          return m;
        }, {})
      ).sort((a, b) => b[1] - a[1]);

      // ---------- MEDIA PLAYS ----------
      const mpRows = await strapi.entityService.findMany(uidMP, {
        filters,
        fields: ["id", "mediaType", fieldTS],
        pagination: { limit: 100000 },
      });
      const mediaTypes = Object.entries(
        mpRows.reduce((m, r) => {
          const k = (r.mediaType || "unknown").toString().toLowerCase();
          m[k] = (m[k] || 0) + 1;
          return m;
        }, {})
      ).sort((a, b) => b[1] - a[1]);

      // ---------- TIME SERIES (by day) ----------
      const bucket = {};
      for (let i = 0; i < days; i++) {
        const d = now.minus({ days: days - 1 - i }).toISODate(); // YYYY-MM-DD
        bucket[d] = { date: d, views: 0, clicks: 0, plays: 0 };
      }

      const incByISO = (iso, key) => {
        if (!iso) return;
        // ISO string → YYYY-MM-DD
        const d = DateTime.fromISO(iso, { zone: "utc" }).toISODate();
        if (d && bucket[d]) bucket[d][key]++;
      };

      pvRows.forEach((r) => incByISO(r[fieldTS], "views"));
      lcRows.forEach((r) => incByISO(r[fieldTS], "clicks"));
      mpRows.forEach((r) => incByISO(r[fieldTS], "plays"));

      const series = Object.values(bucket);

      ctx.body = {
        ok: true,
        range,
        totals: {
          views: pvRows.length,
          clicks: lcRows.length,
          plays: mpRows.length,
        },
        sources,
        mediums,
        refDomains,
        devices,
        platforms,
        mediaTypes,
        series,
      };
    } catch (err) {
      strapi.log.error("[analytics.rollups] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  async geo(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      const range = String(ctx.query.range || "30d");
      if (!bandId) return ctx.badRequest("bandId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const rows = await strapi.entityService.findMany(uidPV, {
        filters: { band: { id: bandId }, [fieldTS]: { $gte: from, $lte: to } },
        fields: ["id", "city", "region", "country", "lat", "lon"],
        pagination: { limit: 100000 },
      });

      const map = {};
      for (const r of rows) {
        const city = r.city || "Unknown";
        const key = `${city}|${r.region || ""}|${r.country || ""}`;
        if (!map[key])
          map[key] = {
            city,
            region: r.region || "",
            country: r.country || "",
            lat: r.lat,
            lon: r.lon,
            count: 0,
          };
        map[key].count++;
      }
      const list = Object.values(map).sort((a, b) => b.count - a.count).slice(0, 50);

      ctx.body = { ok: true, list };
    } catch (err) {
      strapi.log.error("[analytics.geo] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  async transitions(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      const range = String(ctx.query.range || "30d");
      if (!bandId) return ctx.badRequest("bandId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const filters = { band: { id: bandId }, [fieldTS]: { $gte: from, $lte: to } };

      const views = await strapi.entityService.count(uidPV, { filters });
      const clicks = await strapi.entityService.count(uidLC, { filters });
      const plays = await strapi.entityService.count(uidMP, { filters });

      const links = [
        { source: "Views", target: "Clicks", value: safeInt(clicks) },
        { source: "Clicks", target: "Plays", value: safeInt(plays) },
      ];
      const nodes = [
        { id: "Views", value: safeInt(views) },
        { id: "Clicks", value: safeInt(clicks) },
        { id: "Plays", value: safeInt(plays) },
      ];

      ctx.body = { ok: true, nodes, links };
    } catch (err) {
      strapi.log.error("[analytics.transitions] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },
};
