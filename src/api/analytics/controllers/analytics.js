"use strict";

const { DateTime } = require("luxon");
const { normalizeSignals, computePulse, fetchEntityData } = require("../services/pulse");
const { fetchWhatsHot } = require("../services/whatsHot");
const {
  computeActivityTotals,
  evaluateSurgePush,
  createSurgeNotifications,
  updateSnapshotAfterPush,
} = require("../services/pushEligibility");
const { fetchGeoStateCounts } = require("../services/geoStates");

const uidPV = "api::band-page-view.band-page-view";
const uidLC = "api::link-click.link-click";
const uidMP = "api::media-play.media-play";
const uidScan = "api::scan.scan";
const uidUIEvent = "api::band-ui-event.band-ui-event";

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

  /**
   * GET /analytics/follows
   * Follow analytics: opens, confirms, redirects, platform breakdown
   */
  async follows(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      const bandSlug = ctx.query.bandSlug;
      if (!bandId && !bandSlug) return ctx.badRequest("bandId or bandSlug required");

      const range = String(ctx.query.range || "30d");
      const days = Number(range.replace("d", "")) || 30;

      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      // Build filter - support both band relation and bandSlug fallback
      const eventFilter = {
        eventName: {
          $in: [
            "follow_modal_open",
            "follow_platform_toggle",
            "follow_confirm",
            "follow_redirect",
          ],
        },
      };

      // Only add timestamp filter if we have valid dates
      if (from && to) {
        eventFilter[fieldTS] = { $gte: from, $lte: to };
      }

      // Try band relation first, fall back to bandSlug
      if (bandId) {
        eventFilter.band = { id: bandId };
      }

      // Fetch all follow-related UI events for this band in range
      let rows = await strapi.entityService.findMany(uidUIEvent, {
        filters: eventFilter,
        fields: ["id", "eventName", "payload", fieldTS, "createdAt", "updatedAt", "bandSlug"],
        pagination: { limit: 100000 },
      });

      // If no results with band relation and we have bandId, try fetching band's slug and query by that
      if (rows.length === 0 && bandId) {
        const band = await strapi.entityService.findOne("api::band.band", bandId, { fields: ["slug"] });
        if (band?.slug) {
          const slugFilter = {
            ...eventFilter,
            band: undefined,
            bandSlug: band.slug,
          };
          delete slugFilter.band;
          rows = await strapi.entityService.findMany(uidUIEvent, {
            filters: slugFilter,
            fields: ["id", "eventName", "payload", fieldTS, "createdAt", "updatedAt", "bandSlug"],
            pagination: { limit: 100000 },
          });
        }
      }

      // Count by event type
      let opens = 0;
      let confirms = 0;
      let redirects = 0;
      const platformCounts = {};

      // Daily series bucket
      const bucket = {};
      for (let i = 0; i < days; i++) {
        const d = now.minus({ days: days - 1 - i }).toISODate();
        bucket[d] = { date: d, opens: 0, confirms: 0, redirects: 0 };
      }

      for (const row of rows) {
        const eventName = row.eventName;
        const iso = resolveDate(row);
        const day = iso ? DateTime.fromISO(iso, { zone: "utc" }).toISODate() : null;

        if (eventName === "follow_modal_open") {
          opens++;
          if (day && bucket[day]) bucket[day].opens++;
        } else if (eventName === "follow_confirm") {
          confirms++;
          if (day && bucket[day]) bucket[day].confirms++;
        } else if (eventName === "follow_redirect") {
          redirects++;
          if (day && bucket[day]) bucket[day].redirects++;

          // Extract platformId from payload
          const payload = row.payload || {};
          const platformId = payload.platformId || "unknown";
          platformCounts[platformId] = (platformCounts[platformId] || 0) + 1;
        }
      }

      // Sort platforms by count descending
      const platforms = Object.entries(platformCounts)
        .map(([platformId, count]) => ({ platformId, count }))
        .sort((a, b) => b.count - a.count);

      const series = Object.values(bucket);

      // Funnel conversion rates
      const confirmRate = opens > 0 ? Math.round((confirms / opens) * 1000) / 10 : 0;
      const redirectRate = confirms > 0 ? Math.round((redirects / confirms) * 1000) / 10 : 0;
      const overallRate = opens > 0 ? Math.round((redirects / opens) * 1000) / 10 : 0;

      ctx.body = {
        ok: true,
        range,
        totals: {
          opens,
          confirms,
          redirects,
        },
        funnel: {
          confirmRate,
          redirectRate,
          overallRate,
        },
        platforms,
        series,
        _debug: {
          bandId,
          from,
          to,
          rowCount: rows.length,
        },
      };
    } catch (err) {
      strapi.log.error("[analytics.follows] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  // ============================================================
  // EVENT ANALYTICS ENDPOINTS
  // ============================================================

  /**
   * GET /analytics/event-rollups
   * Main rollups for event analytics: views, sources, devices, time series
   */
  async eventRollups(ctx) {
    try {
      const eventId = Number(ctx.query.eventId);
      if (!eventId) return ctx.badRequest("eventId required");

      const range = String(ctx.query.range || "30d");
      const days = Number(range.replace("d", "")) || 30;

      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const uidEPV = "api::event-page-view.event-page-view";

      const filters = {
        event: { id: eventId },
        [fieldTS]: { $gte: from, $lte: to },
      };

      // Fetch all event page views in range
      const pvRows = await strapi.entityService.findMany(uidEPV, {
        filters,
        fields: [
          "id",
          "userAgent",
          "refDomain",
          "refSource",
          "refMedium",
          "sourceCategory",
          "city",
          "country",
          "deviceType",
          "os",
          "browser",
          "entryType",
          fieldTS,
          "createdAt",
          "updatedAt",
        ],
        pagination: { limit: 100000 },
      });

      // Helper to bucket by field
      const by = (rows, pick) =>
        rows.reduce((m, r) => {
          const raw = pick(r);
          const k = (raw || "unknown").toString().toLowerCase();
          m[k] = (m[k] || 0) + 1;
          return m;
        }, {});

      // Source/Medium breakdowns
      const sources = Object.entries(by(pvRows, (r) => r.refSource)).sort((a, b) => b[1] - a[1]);
      const mediums = Object.entries(by(pvRows, (r) => r.refMedium)).sort((a, b) => b[1] - a[1]);
      const sourceCategories = Object.entries(by(pvRows, (r) => r.sourceCategory)).sort((a, b) => b[1] - a[1]);
      const refDomains = Object.entries(by(pvRows, (r) => r.refDomain))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // Device breakdown
      const devices = pvRows.reduce(
        (m, r) => {
          const k = r.deviceType || "unknown";
          m[k] = (m[k] || 0) + 1;
          return m;
        },
        { desktop: 0, mobile: 0, tablet: 0, bot: 0, unknown: 0 }
      );

      // OS breakdown
      const osList = Object.entries(by(pvRows, (r) => r.os)).sort((a, b) => b[1] - a[1]);

      // Browser breakdown
      const browsers = Object.entries(by(pvRows, (r) => r.browser)).sort((a, b) => b[1] - a[1]);

      // Entry type (web vs qr)
      const entryTypes = Object.entries(by(pvRows, (r) => r.entryType)).sort((a, b) => b[1] - a[1]);

      // Country breakdown
      const countries = Object.entries(by(pvRows, (r) => r.country))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

      // Time series (by day)
      const bucket = {};
      for (let i = 0; i < days; i++) {
        const d = now.minus({ days: days - 1 - i }).toISODate();
        bucket[d] = { date: d, views: 0 };
      }

      pvRows.forEach((r) => {
        const iso = resolveDate(r);
        if (!iso) return;
        const d = DateTime.fromISO(iso, { zone: "utc" }).toISODate();
        if (d && bucket[d]) bucket[d].views++;
      });

      const series = Object.values(bucket);

      ctx.body = {
        ok: true,
        range,
        totals: {
          views: pvRows.length,
        },
        sources,
        mediums,
        sourceCategories,
        refDomains,
        devices,
        osList,
        browsers,
        entryTypes,
        countries,
        series,
      };
    } catch (err) {
      strapi.log.error("[analytics.eventRollups] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  /**
   * GET /analytics/event-geo
   * Geo breakdown for event analytics
   */
  async eventGeo(ctx) {
    try {
      const eventId = Number(ctx.query.eventId);
      const range = String(ctx.query.range || "30d");
      if (!eventId) return ctx.badRequest("eventId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const uidEPV = "api::event-page-view.event-page-view";

      const rows = await strapi.entityService.findMany(uidEPV, {
        filters: { event: { id: eventId }, [fieldTS]: { $gte: from, $lte: to } },
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
      strapi.log.error("[analytics.eventGeo] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  /**
   * GET /analytics/event-sources
   * Detailed source/medium/referrer breakdown for events
   */
  async eventSources(ctx) {
    try {
      const eventId = Number(ctx.query.eventId);
      const range = String(ctx.query.range || "30d");
      if (!eventId) return ctx.badRequest("eventId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const uidEPV = "api::event-page-view.event-page-view";

      const rows = await strapi.entityService.findMany(uidEPV, {
        filters: { event: { id: eventId }, [fieldTS]: { $gte: from, $lte: to } },
        fields: [
          "id",
          "refSource",
          "refMedium",
          "refDomain",
          "sourceCategory",
          "utmSource",
          "utmMedium",
          "utmCampaign",
          "entryType",
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

      // Source breakdown
      const sources = Object.entries(by(rows, (r) => r.refSource))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Medium breakdown
      const mediums = Object.entries(by(rows, (r) => r.refMedium))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Category breakdown
      const categories = Object.entries(by(rows, (r) => r.sourceCategory))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Top referrer domains
      const domains = Object.entries(by(rows, (r) => r.refDomain))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // UTM campaigns
      const campaigns = Object.entries(by(rows, (r) => r.utmCampaign))
        .filter(([k]) => k !== "unknown" && k !== "")
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Entry types (web vs qr)
      const entryTypes = Object.entries(by(rows, (r) => r.entryType))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      ctx.body = {
        ok: true,
        range,
        total: rows.length,
        sources,
        mediums,
        categories,
        domains,
        campaigns,
        entryTypes,
      };
    } catch (err) {
      strapi.log.error("[analytics.eventSources] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  /**
   * GET /analytics/event-devices
   * Device/browser/OS breakdown for events
   */
  async eventDevices(ctx) {
    try {
      const eventId = Number(ctx.query.eventId);
      const range = String(ctx.query.range || "30d");
      if (!eventId) return ctx.badRequest("eventId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const uidEPV = "api::event-page-view.event-page-view";

      const rows = await strapi.entityService.findMany(uidEPV, {
        filters: { event: { id: eventId }, [fieldTS]: { $gte: from, $lte: to } },
        fields: ["id", "deviceType", "os", "browser", "screenW", "screenH"],
        pagination: { limit: 100000 },
      });

      const by = (rows, pick) =>
        rows.reduce((m, r) => {
          const raw = pick(r);
          const k = (raw || "unknown").toString().toLowerCase();
          m[k] = (m[k] || 0) + 1;
          return m;
        }, {});

      // Device type breakdown
      const deviceTypes = Object.entries(by(rows, (r) => r.deviceType))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // OS breakdown
      const osList = Object.entries(by(rows, (r) => r.os))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Browser breakdown
      const browsers = Object.entries(by(rows, (r) => r.browser))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Screen size buckets
      const screenBuckets = rows.reduce((m, r) => {
        if (!r.screenW) return m;
        let bucket = "unknown";
        if (r.screenW < 576) bucket = "xs (<576)";
        else if (r.screenW < 768) bucket = "sm (576-767)";
        else if (r.screenW < 992) bucket = "md (768-991)";
        else if (r.screenW < 1200) bucket = "lg (992-1199)";
        else bucket = "xl (1200+)";
        m[bucket] = (m[bucket] || 0) + 1;
        return m;
      }, {});

      const screenSizes = Object.entries(screenBuckets)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      ctx.body = {
        ok: true,
        range,
        total: rows.length,
        deviceTypes,
        osList,
        browsers,
        screenSizes,
      };
    } catch (err) {
      strapi.log.error("[analytics.eventDevices] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  // ============================================================
  // QR ANALYTICS ENDPOINTS
  // ============================================================

  /**
   * GET /analytics/qr-rollups
   * Main rollups for QR scans: totals, sources, devices, time series
   */
  async qrRollups(ctx) {
    try {
      const qrId = Number(ctx.query.qrId);
      const range = String(ctx.query.range || "30d");
      if (!qrId) return ctx.badRequest("qrId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const rows = await strapi.entityService.findMany(uidScan, {
        filters: { qr: { id: qrId }, date: { $gte: from, $lte: to } },
        fields: [
          "id", "date", "country", "city", "region",
          "deviceType", "os", "browser", "refSource", "refMedium",
          "entryType", "createdAt",
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

      // Sources breakdown
      const sources = Object.entries(by(rows, (r) => r.refSource))
        .sort((a, b) => b[1] - a[1]);

      // Countries breakdown
      const countries = Object.entries(by(rows, (r) => r.country))
        .sort((a, b) => b[1] - a[1]);

      // Device types
      const devices = by(rows, (r) => r.deviceType);

      // Browsers
      const browsers = Object.entries(by(rows, (r) => r.browser))
        .sort((a, b) => b[1] - a[1]);

      // OS
      const osList = Object.entries(by(rows, (r) => r.os))
        .sort((a, b) => b[1] - a[1]);

      // Entry types (qr vs web)
      const entryTypes = Object.entries(by(rows, (r) => r.entryType))
        .sort((a, b) => b[1] - a[1]);

      // Time series (daily)
      const seriesMap = {};
      for (let i = 0; i < days; i++) {
        const d = now.minus({ days: days - 1 - i }).toISODate();
        seriesMap[d] = { date: d, scans: 0 };
      }
      rows.forEach((r) => {
        const ts = resolveScanDate(r);
        if (!ts) return;
        const d = DateTime.fromISO(ts, { zone: "utc" }).toISODate();
        if (seriesMap[d]) seriesMap[d].scans++;
      });
      const series = Object.values(seriesMap);

      ctx.body = {
        ok: true,
        range,
        totals: { scans: rows.length },
        sources,
        countries,
        devices,
        browsers,
        osList,
        entryTypes,
        series,
      };
    } catch (err) {
      strapi.log.error("[analytics.qrRollups] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  /**
   * GET /analytics/qr-geo
   * Geographic breakdown for QR scans
   */
  async qrGeo(ctx) {
    try {
      const qrId = Number(ctx.query.qrId);
      const range = String(ctx.query.range || "30d");
      if (!qrId) return ctx.badRequest("qrId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const rows = await strapi.entityService.findMany(uidScan, {
        filters: { qr: { id: qrId }, date: { $gte: from, $lte: to } },
        fields: ["id", "country", "region", "city", "lat", "lon"],
        pagination: { limit: 100000 },
      });

      // Aggregate by city+region+country
      const geoMap = {};
      rows.forEach((r) => {
        const key = `${r.city || "unknown"}|${r.region || ""}|${r.country || ""}`;
        if (!geoMap[key]) {
          geoMap[key] = {
            city: r.city || "Unknown",
            region: r.region || "",
            country: r.country || "",
            lat: r.lat,
            lon: r.lon,
            count: 0,
          };
        }
        geoMap[key].count++;
      });

      const list = Object.values(geoMap).sort((a, b) => b.count - a.count);

      // Country totals
      const countryMap = {};
      rows.forEach((r) => {
        const c = r.country || "unknown";
        countryMap[c] = (countryMap[c] || 0) + 1;
      });
      const countries = Object.entries(countryMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      ctx.body = {
        ok: true,
        range,
        total: rows.length,
        list,
        countries,
      };
    } catch (err) {
      strapi.log.error("[analytics.qrGeo] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  /**
   * GET /analytics/qr-sources
   * Detailed source/medium/referrer breakdown for QR scans
   */
  async qrSources(ctx) {
    try {
      const qrId = Number(ctx.query.qrId);
      const range = String(ctx.query.range || "30d");
      if (!qrId) return ctx.badRequest("qrId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const rows = await strapi.entityService.findMany(uidScan, {
        filters: { qr: { id: qrId }, date: { $gte: from, $lte: to } },
        fields: [
          "id", "refSource", "refMedium", "refDomain",
          "utmSource", "utmMedium", "utmCampaign", "entryType",
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

      const sources = Object.entries(by(rows, (r) => r.refSource))
        .sort((a, b) => b[1] - a[1]);

      const mediums = Object.entries(by(rows, (r) => r.refMedium))
        .sort((a, b) => b[1] - a[1]);

      const refDomains = Object.entries(by(rows, (r) => r.refDomain))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      const campaigns = Object.entries(by(rows, (r) => r.utmCampaign))
        .filter(([k]) => k !== "unknown")
        .sort((a, b) => b[1] - a[1]);

      const entryTypes = Object.entries(by(rows, (r) => r.entryType))
        .sort((a, b) => b[1] - a[1]);

      ctx.body = {
        ok: true,
        range,
        total: rows.length,
        sources,
        mediums,
        refDomains,
        campaigns,
        entryTypes,
      };
    } catch (err) {
      strapi.log.error("[analytics.qrSources] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  /**
   * GET /analytics/qr-devices
   * Device/browser/OS breakdown for QR scans
   */
  async qrDevices(ctx) {
    try {
      const qrId = Number(ctx.query.qrId);
      const range = String(ctx.query.range || "30d");
      if (!qrId) return ctx.badRequest("qrId required");

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const from = now.minus({ days: days - 1 }).startOf("day").toISO();
      const to = now.endOf("day").toISO();

      const rows = await strapi.entityService.findMany(uidScan, {
        filters: { qr: { id: qrId }, date: { $gte: from, $lte: to } },
        fields: ["id", "deviceType", "os", "browser", "screenW", "screenH"],
        pagination: { limit: 100000 },
      });

      const by = (rows, pick) =>
        rows.reduce((m, r) => {
          const raw = pick(r);
          const k = (raw || "unknown").toString().toLowerCase();
          m[k] = (m[k] || 0) + 1;
          return m;
        }, {});

      const deviceTypes = Object.entries(by(rows, (r) => r.deviceType))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const osList = Object.entries(by(rows, (r) => r.os))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const browsers = Object.entries(by(rows, (r) => r.browser))
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Screen size buckets
      const screenBuckets = rows.reduce((m, r) => {
        if (!r.screenW) return m;
        let bucket = "unknown";
        if (r.screenW < 576) bucket = "xs (<576)";
        else if (r.screenW < 768) bucket = "sm (576-767)";
        else if (r.screenW < 992) bucket = "md (768-991)";
        else if (r.screenW < 1200) bucket = "lg (992-1199)";
        else bucket = "xl (1200+)";
        m[bucket] = (m[bucket] || 0) + 1;
        return m;
      }, {});

      const screenSizes = Object.entries(screenBuckets)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      ctx.body = {
        ok: true,
        range,
        total: rows.length,
        deviceTypes,
        osList,
        browsers,
        screenSizes,
      };
    } catch (err) {
      strapi.log.error("[analytics.qrDevices] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  // ============================================================
  // MBQ PULSE ENDPOINT
  // ============================================================

  /**
   * GET /analytics/pulse
   * Unified pulse score and momentum for band/event/qr
   * Params: entityType=band|event|qr, entityId, range=7d|30d|90d|365d
   */
  async pulse(ctx) {
    try {
      const entityType = String(ctx.query.entityType || "").toLowerCase();
      const entityId = Number(ctx.query.entityId);
      const range = String(ctx.query.range || "30d");

      if (!["band", "event", "qr"].includes(entityType)) {
        return ctx.badRequest("entityType must be band, event, or qr");
      }
      if (!entityId) {
        return ctx.badRequest("entityId required");
      }

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const nowJS = now.toJSDate();

      // Current period
      const currentFrom = now.minus({ days: days - 1 }).startOf("day").toISO();
      const currentTo = now.endOf("day").toISO();

      // Previous period (same length, immediately preceding)
      const prevFrom = now.minus({ days: days * 2 - 1 }).startOf("day").toISO();
      const prevTo = now.minus({ days }).endOf("day").toISO();

      // Fetch data for both periods
      const [currentRaw, previousRaw] = await Promise.all([
        fetchEntityData(strapi, entityType, entityId, days, currentFrom, currentTo),
        fetchEntityData(strapi, entityType, entityId, days, prevFrom, prevTo),
      ]);

      if (!currentRaw) {
        return ctx.badRequest("Failed to fetch entity data");
      }

      // Normalize into unified signals
      const currentSignals = normalizeSignals(entityType, entityId, range, currentRaw);
      const previousSignals = previousRaw
        ? normalizeSignals(entityType, entityId, range, previousRaw)
        : null;

      // Compute pulse
      const pulse = computePulse(currentSignals, previousSignals);

      // ============================================================
      // SNAPSHOT + SURGE DETECTION (bands only)
      // ============================================================
      let surgeEvaluation = null;
      
      if (entityType === "band") {
        try {
          // Load previous snapshot
          const prevSnapshots = await strapi.entityService.findMany(
            "api::pulse-snapshot.pulse-snapshot",
            {
              filters: { band: entityId, rangeKey: range },
              sort: { computedAt: "desc" },
              limit: 1,
            }
          );
          const prevSnapshot = prevSnapshots[0] || null;

          // Compute activity totals
          const totalActivity = computeActivityTotals(currentSignals);
          const prevTotalActivity = prevSnapshot?.totalActivity || 0;
          const absoluteIncrease = totalActivity - prevTotalActivity;

          // Detect momentum change
          const prevMomentum = prevSnapshot?.momentumState || "steady";
          const currentMomentum = pulse.momentumState;
          const momentumChanged = prevMomentum !== currentMomentum;

          // Create or update snapshot
          const snapshotData = {
            band: entityId,
            rangeKey: range,
            pulseScore: pulse.pulseScore,
            momentumState: currentMomentum,
            totalActivity,
            growthPct: pulse.drivers?.growthPct || 0,
            absoluteIncrease,
            computedAt: now.toISO(),
            drivers: pulse.drivers,
          };

          // Update lastMomentumChangeAt if momentum changed
          if (momentumChanged) {
            snapshotData.lastMomentumChangeAt = now.toISO();
          } else if (prevSnapshot?.lastMomentumChangeAt) {
            snapshotData.lastMomentumChangeAt = prevSnapshot.lastMomentumChangeAt;
          }

          // Preserve surge push tracking
          if (prevSnapshot) {
            snapshotData.surgePushSent = prevSnapshot.surgePushSent;
            snapshotData.lastSurgePushAt = prevSnapshot.lastSurgePushAt;
          }

          // Reset surgePushSent if momentum dropped below steady
          if (currentMomentum === "steady" || currentMomentum === "cooling") {
            snapshotData.surgePushSent = false;
          }

          let snapshot;
          if (prevSnapshot) {
            snapshot = await strapi.entityService.update(
              "api::pulse-snapshot.pulse-snapshot",
              prevSnapshot.id,
              { data: snapshotData }
            );
          } else {
            snapshot = await strapi.entityService.create(
              "api::pulse-snapshot.pulse-snapshot",
              { data: snapshotData }
            );
          }

          // ============================================================
          // SURGE PUSH EVALUATION
          // ============================================================
          // Only evaluate if transitioning INTO surging
          if (prevMomentum !== "surging" && currentMomentum === "surging") {
            // Get band with user
            const band = await strapi.entityService.findOne("api::band.band", entityId, {
              populate: ["users_permissions_user"],
            });

            if (band?.users_permissions_user) {
              const user = band.users_permissions_user;

              surgeEvaluation = evaluateSurgePush({
                user,
                band,
                currentPulse: pulse,
                currentSignals,
                prevSnapshot,
                now: nowJS,
              });

              // Create notifications if eligible
              if (surgeEvaluation.eligible && surgeEvaluation.wouldSend) {
                const notifResult = await createSurgeNotifications(strapi, {
                  user,
                  band,
                  notification: surgeEvaluation.notification,
                });

                if (notifResult.created) {
                  await updateSnapshotAfterPush(strapi, snapshot.id, now);
                  surgeEvaluation.notificationCreated = true;
                } else {
                  surgeEvaluation.notificationCreated = false;
                  surgeEvaluation.notificationSkipReason = notifResult.reason;
                }
              }
            }
          }
        } catch (snapshotErr) {
          strapi.log.warn("[analytics.pulse] Snapshot/surge error:", snapshotErr);
          // Don't fail the whole request for snapshot errors
        }
      }

      ctx.body = {
        ok: true,
        entityType,
        entityId,
        range,
        signals: currentSignals,
        pulse,
        surgeEvaluation: surgeEvaluation ? {
          eligible: surgeEvaluation.eligible,
          wouldSend: surgeEvaluation.wouldSend,
          notificationCreated: surgeEvaluation.notificationCreated || false,
        } : null,
      };
    } catch (err) {
      strapi.log.error("[analytics.pulse] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  // ============================================================
  // PUSH DRY-RUN ENDPOINT
  // ============================================================

  /**
   * GET /analytics/push/dry-run
   * Returns whether a push would be sent and why, plus preview copy
   * Params: bandId, range=30d
   */
  async pushDryRun(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      const range = String(ctx.query.range || "30d");

      if (!bandId) {
        return ctx.badRequest("bandId required");
      }

      const days = Number(range.replace("d", "")) || 30;
      const now = DateTime.utc();
      const nowJS = now.toJSDate();

      // Current period
      const currentFrom = now.minus({ days: days - 1 }).startOf("day").toISO();
      const currentTo = now.endOf("day").toISO();

      // Previous period
      const prevFrom = now.minus({ days: days * 2 - 1 }).startOf("day").toISO();
      const prevTo = now.minus({ days }).endOf("day").toISO();

      // Fetch data
      const [currentRaw, previousRaw] = await Promise.all([
        fetchEntityData(strapi, "band", bandId, days, currentFrom, currentTo),
        fetchEntityData(strapi, "band", bandId, days, prevFrom, prevTo),
      ]);

      if (!currentRaw) {
        return ctx.badRequest("Failed to fetch band data");
      }

      // Normalize and compute pulse
      const currentSignals = normalizeSignals("band", bandId, range, currentRaw);
      const previousSignals = previousRaw
        ? normalizeSignals("band", bandId, range, previousRaw)
        : null;
      const pulse = computePulse(currentSignals, previousSignals);

      // Load previous snapshot
      const prevSnapshots = await strapi.entityService.findMany(
        "api::pulse-snapshot.pulse-snapshot",
        {
          filters: { band: bandId, rangeKey: range },
          sort: { computedAt: "desc" },
          limit: 1,
        }
      );
      const prevSnapshot = prevSnapshots[0] || null;

      // Get band with user
      const band = await strapi.entityService.findOne("api::band.band", bandId, {
        populate: ["users_permissions_user"],
      });

      if (!band) {
        return ctx.notFound("Band not found");
      }

      const user = band.users_permissions_user;

      // Evaluate surge push
      const evaluation = evaluateSurgePush({
        user,
        band,
        currentPulse: pulse,
        currentSignals,
        prevSnapshot,
        now: nowJS,
      });

      ctx.body = {
        ok: true,
        bandId,
        range,
        currentMomentum: pulse.momentumState,
        previousMomentum: prevSnapshot?.momentumState || "steady",
        pulseScore: pulse.pulseScore,
        evaluation: {
          eligible: evaluation.eligible,
          wouldSend: evaluation.wouldSend,
          reasons: evaluation.reasons,
          notification: evaluation.notification,
          debugInfo: evaluation.debugInfo,
        },
      };
    } catch (err) {
      strapi.log.error("[analytics.pushDryRun] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  // ============================================================
  // PUSH OPT-IN ENDPOINT
  // ============================================================

  /**
   * POST /push/opt-in
   * Toggle push notification opt-in for authenticated user
   */
  async pushOptIn(ctx) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("You must be logged in");
      }

      // Toggle the current value
      const newValue = !user.pushOptIn;

      await strapi.entityService.update(
        "plugin::users-permissions.user",
        user.id,
        { data: { pushOptIn: newValue } }
      );

      ctx.body = {
        ok: true,
        pushOptIn: newValue,
      };
    } catch (err) {
      strapi.log.error("[analytics.pushOptIn] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  /**
   * GET /push/opt-in/status
   * Get current push opt-in status for authenticated user
   */
  async pushOptInStatus(ctx) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("You must be logged in");
      }

      // Calculate account age
      const userCreatedAt = DateTime.fromISO(user.createdAt);
      const accountAgeDays = Math.floor(DateTime.utc().diff(userCreatedAt, "days").days);

      ctx.body = {
        ok: true,
        pushOptIn: user.pushOptIn || false,
        accountAgeDays,
        canOptIn: accountAgeDays >= 7,
      };
    } catch (err) {
      strapi.log.error("[analytics.pushOptInStatus] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  // ============================================================
  // GEO STATES ENDPOINT (USA Heat Map)
  // ============================================================

  /**
   * GET /analytics/geo-states
   * Returns US state-level counts for heat map visualization
   * Params: entityType=band|event|qr, entityId, range=7d|30d|365d, metric=views|qrScans|linkClicks|follows
   */
  async geoStates(ctx) {
    try {
      const entityType = String(ctx.query.entityType || "").toLowerCase();
      const entityId = Number(ctx.query.entityId);
      const range = String(ctx.query.range || "30d");
      const metric = String(ctx.query.metric || "views");

      if (!["band", "event", "qr"].includes(entityType)) {
        return ctx.badRequest("entityType must be band, event, or qr");
      }
      if (!entityId) {
        return ctx.badRequest("entityId required");
      }

      const result = await fetchGeoStateCounts(strapi, {
        entityType,
        entityId,
        range,
        metric,
      });

      if (result.error) {
        return ctx.badRequest(result.error);
      }

      ctx.body = result;
    } catch (err) {
      strapi.log.error("[analytics.geoStates] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },

  // ============================================================
  // WHAT'S HOT / MOMENTUM PROMPTS
  // ============================================================

  /**
   * GET /pulse/whats-hot
   * Returns hot summary + share-ready prompt cards for band dashboard
   * Params: bandId, window=24h (only 24h supported in V1)
   */
  async whatsHot(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      // V1: enforce 24h window
      const windowHours = 24;

      if (!bandId) {
        return ctx.badRequest("bandId required");
      }

      const result = await fetchWhatsHot(strapi, bandId, windowHours);

      if (!result.ok) {
        return ctx.badRequest(result.error || "Failed to fetch what's hot");
      }

      ctx.body = result;
    } catch (err) {
      strapi.log.error("[analytics.whatsHot] ", err);
      ctx.status = 500;
      ctx.body = { ok: false, error: err?.message || "Internal Server Error" };
    }
  },
};
