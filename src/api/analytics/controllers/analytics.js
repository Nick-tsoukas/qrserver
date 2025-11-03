"use strict";

const { DateTime } = require("luxon");

const uidPV = "api::band-page-view.band-page-view";
const uidLC = "api::link-click.link-click";
const uidMP = "api::media-play.media-play";
const uidScan = "api::scan.scan"; // 👈 NEW

const fieldTS = "timestamp"; // explicit datetime in your schemas
const safeInt = (n) => (Number.isFinite(n) ? n : 0);

/**
 * Resolve the best timestamp for a row.
 * Priority: explicit timestamp -> updatedAt -> createdAt.
 * Always returns ISO in UTC or null.
 */
const resolveDate = (row = {}) => {
  const raw = row[fieldTS] || row.updatedAt || row.createdAt || null;

  if (!raw) return null;
  // normalize to UTC
  const dt = DateTime.fromISO(raw, { zone: "utc" });
  return dt.isValid ? dt.toISO() : null;
};

/**
 * For scans we often have "date" instead of "timestamp"
 */
const resolveScanDate = (row = {}) => {
  const raw = row.date || row[fieldTS] || row.updatedAt || row.createdAt || null;

  if (!raw) return null;
  const dt = DateTime.fromISO(raw, { zone: "utc" });
  return dt.isValid ? dt.toISO() : null;
};

/**
 * Normalize mediaType → "song" | "video" | "other"
 */
const normalizeMediaType = (mt) => {
  const v = String(mt || "").toLowerCase();
  if (!v) return "other";
  if (v === "song" || v === "audio" || v === "music") return "song";
  if (v === "video" || v === "youtube" || v === "yt") return "video";
  return "other";
};

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

      // Common filters (for pv, clicks, media)
      const filters = {
        band: { id: bandId },
        [fieldTS]: { $gte: from, $lte: to },
      };

      // ---------- PAGE VIEWS ----------
      const pvRows = await strapi.entityService.findMany(uidPV, {
        filters,
        fields: [
          "id",
          "userAgent",
          "refDomain",
          "refSource",
          "refMedium",
          "city",
          fieldTS,
          "createdAt",
          "updatedAt",
        ],
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
        fields: ["id", "platform", fieldTS, "createdAt", "updatedAt"],
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
        filters: {
          band: { id: bandId },
          [fieldTS]: { $gte: from, $lte: to },
        },
        fields: ["id", "mediaType", fieldTS, "createdAt", "updatedAt"],
        pagination: { limit: 100000 },
      });

      const mediaTypes = Object.entries(
        mpRows.reduce((m, r) => {
          const k = (r.mediaType || "unknown").toString().toLowerCase();
          m[k] = (m[k] || 0) + 1;
          return m;
        }, {})
      ).sort((a, b) => b[1] - a[1]);

      // ---------- QR SCANS ----------
      // 1) scans that have band directly
      const scanRowsDirect = await strapi.entityService.findMany(uidScan, {
        filters: {
          band: { id: bandId },
          date: { $gte: from, $lte: to },
        },
        fields: ["id", "date", "createdAt", "updatedAt"],
        populate: { qr: true, band: true },
        pagination: { limit: 100000 },
      });

      // 2) scans that only have qr → band
      const scanRowsViaQr = await strapi.entityService.findMany(uidScan, {
        filters: {
          qr: {
            band: { id: bandId },
          },
          date: { $gte: from, $lte: to },
        },
        fields: ["id", "date", "createdAt", "updatedAt"],
        populate: { qr: { populate: ["band"] }, band: true },
        pagination: { limit: 100000 },
      });

      // ---------- TIME SERIES (by day) ----------
      const bucket = {};
      for (let i = 0; i < days; i++) {
        const d = now.minus({ days: days - 1 - i }).toISODate(); // YYYY-MM-DD
        bucket[d] = {
          date: d,
          views: 0,
          clicks: 0,
          plays: 0,
          songPlays: 0,
          videoPlays: 0,
          qrScans: 0, // 👈 NEW
        };
      }

      const incByISO = (iso, key) => {
        if (!iso) return;
        const d = DateTime.fromISO(iso, { zone: "utc" }).toISODate();
        if (d && bucket[d]) bucket[d][key]++;
      };

      // page views → views
      pvRows.forEach((r) => {
        const iso = resolveDate(r);
        incByISO(iso, "views");
      });

      // link clicks → clicks
      lcRows.forEach((r) => {
        const iso = resolveDate(r);
        incByISO(iso, "clicks");
      });

      // media plays → plays + type split
      const mpSeen = new Set();
      let totalPlays = 0;
      let totalSongPlays = 0;
      let totalVideoPlays = 0;
      let totalOtherPlays = 0;

      mpRows.forEach((r) => {
        const iso = resolveDate(r);
        if (!iso) return;
        const day = DateTime.fromISO(iso, { zone: "utc" }).toISODate();
        if (!day || !bucket[day]) return;

        const key = `${r.id}:${day}`;
        if (mpSeen.has(key)) return; // dedupe
        mpSeen.add(key);

        bucket[day].plays++;
        totalPlays++;

        const type = normalizeMediaType(r.mediaType);
        if (type === "song") {
          bucket[day].songPlays++;
          totalSongPlays++;
        } else if (type === "video") {
          bucket[day].videoPlays++;
          totalVideoPlays++;
        } else {
          totalOtherPlays++;
        }
      });

      // ---------- process scans → qrScans ----------
      const allScans = [...scanRowsDirect, ...scanRowsViaQr];
      const seenScanIds = new Set();
      let totalQrScans = 0;

      allScans.forEach((s) => {
        if (s.id && seenScanIds.has(s.id)) return;
        if (s.id) seenScanIds.add(s.id);

        const iso = resolveScanDate(s);
        if (!iso) return;
        const day = DateTime.fromISO(iso, { zone: "utc" }).toISODate();
        if (!day || !bucket[day]) return;

        bucket[day].qrScans++;
        totalQrScans++;
      });

      const series = Object.values(bucket);

      // 🔽🔽🔽 NEW: try to pull external metrics (YouTube/Spotify) if those CTs exist
      let external = {};
      try {
        const extRows = await strapi.entityService.findMany(
          "api::band-external-metric.band-external-metric",
          {
            filters: { band: { id: bandId } },
            sort: ["date:desc"],
            pagination: { limit: 20 },
          }
        );

        for (const row of extRows) {
          const prov = row.provider;
          if (!external[prov]) {
            external[prov] = {
              connected: true,
              lastFetchedAt: row.syncedAt || row.updatedAt || row.createdAt,
              metrics: row.normalizedData || {},
              history: [],
            };
          }
          external[prov].history.push({
            date: row.date,
            metrics: row.normalized || {},
          });
        }
      } catch (e) {
        // if the CT doesn’t exist yet, don’t crash analytics
        external = {};
      }

      ctx.body = {
        ok: true,
        range,
        totals: {
          views: pvRows.length,
          clicks: lcRows.length,
          plays: totalPlays,
          songPlays: totalSongPlays,
          videoPlays: totalVideoPlays,
          otherPlays: totalOtherPlays,
          qrScans: totalQrScans, // 👈 NEW
        },
        sources,
        mediums,
        refDomains,
        devices,
        platforms,
        mediaTypes,
        series,

        // 👇 NEW, safe, AI-ready
        external,
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
