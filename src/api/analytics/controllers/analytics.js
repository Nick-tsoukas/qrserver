"use strict";

const { DateTime } = require("luxon");

const uidPV = "api::band-page-view.band-page-view";
const uidLC = "api::link-click.link-click";
const uidMP = "api::media-play.media-play";
const uidScan = "api::scan.scan"; // 👈 scans

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
  const raw =
    row.date || row[fieldTS] || row.updatedAt || row.createdAt || null;

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

/**
 * Build simple, layout-safe Muse insights.
 * Only uses data we already have in rollups.
 */
// put this near the top of analytics.js, replacing the old helper
/**
 * Build Muse insights from the data we ALREADY have in this endpoint.
 * We generate a bunch, then sort by importance, then cap to 3 so the UI never explodes.
 */
/**
 * Always include a traffic delta insight (last day vs previous day),
 * then add up to 2 more supporting insights.
 */
const buildMuseInsights = ({ totals = {}, series = [], sources = [] }) => {
  const insights = [];

  const views = totals.views || 0;
  const clicks = totals.clicks || 0;
  const songPlays = totals.songPlays || 0;
  const videoPlays = totals.videoPlays || 0;
  const qrScans = totals.qrScans || 0;
  const mediaPlays = songPlays + videoPlays;

  /* ---------------------------
   * 1) MANDATORY: traffic insight
   * --------------------------- */
  const hasSeries = Array.isArray(series) && series.length > 0;
  const last = hasSeries ? series[series.length - 1] : null;
  const prev = hasSeries && series.length > 1 ? series[series.length - 2] : null;
  const lastViews = last?.views || 0;
  const prevViews = prev?.views || 0;

  if (prevViews > 0) {
    const diffPct = ((lastViews - prevViews) / prevViews) * 100;
    const rounded = Number(diffPct.toFixed(1));
    if (rounded > 0) {
      insights.push({
        title: `Traffic is up ${rounded}% vs. yesterday.`,
        kind: "traffic",
        severity: "success",
        weight: 100,
      });
    } else if (rounded < 0) {
      insights.push({
        title: `Traffic is down ${Math.abs(rounded)}% vs. yesterday.`,
        kind: "traffic",
        severity: "warn",
        weight: 100,
      });
    } else {
      insights.push({
        title: "Traffic is flat vs. yesterday.",
        kind: "traffic",
        severity: "info",
        weight: 100,
      });
    }
  } else if (lastViews > 0) {
    // yesterday had 0, today has some
    insights.push({
      title: "Traffic started coming in today.",
      kind: "traffic",
      severity: "info",
      weight: 100,
    });
  } else {
    // both 0 → still say something, but neutral
    insights.push({
      title: "No traffic recorded yet today.",
      kind: "traffic",
      severity: "info",
      weight: 100,
    });
  }

  /* ---------------------------
   * 2) Supporting insights
   * --------------------------- */

  // engagement
  if (views > 0) {
    const engagement = ((clicks + mediaPlays + qrScans) / views) * 100;
    const roundedEng = Number(engagement.toFixed(1));
    insights.push({
      title: `Engagement rate is ${roundedEng}%.`,
      kind: "engagement",
      severity: "info",
      weight: 80,
    });
  }

  // QR activity
  if (qrScans > 0) {
    insights.push({
      title: `QR codes were scanned ${qrScans} time${qrScans === 1 ? "" : "s"} in this range.`,
      kind: "qr",
      severity: "info",
      weight: 70,
    });
  }

  // media activity
  if (mediaPlays > 0) {
    insights.push({
      title: `Fans played your media ${mediaPlays} time${mediaPlays === 1 ? "" : "s"}.`,
      kind: "media",
      severity: "info",
      weight: 65,
    });
  }

  // top source
  if (Array.isArray(sources) && sources.length) {
    const [topSource, count] = sources[0];
    if (topSource && count) {
      insights.push({
        title: `Top source for this period: ${topSource} (${count}).`,
        kind: "source",
        severity: "info",
        weight: 50,
      });
    }
  }

  // sort just in case + hard cap to 3 so the box never explodes
  return insights
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 3)
    .map(({ weight, ...rest }) => rest);
};


module.exports = {
  async rollups(ctx) {
    try {
      const bandId = Number(ctx.query.bandId);
      if (!bandId) return ctx.badRequest("bandId required");

      const range = String(ctx.query.range || "30d"); // "1d" | "7d" | "30d" | "365d"
      const days = Number(range.replace("d", "")) || 30;

      const now = DateTime.utc();
      const from = now
        .minus({ days: days - 1 })
        .startOf("day")
        .toISO();
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

      const sources = Object.entries(by(pvRows, (r) => r.refSource)).sort(
        (a, b) => b[1] - a[1]
      );
      const mediums = Object.entries(by(pvRows, (r) => r.refMedium)).sort(
        (a, b) => b[1] - a[1]
      );
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
          qrScans: 0, // 👈 scans in series
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

      // ---------- Muse / engagement / growth ----------
      const totalViews = pvRows.length;
      const totalClicks = lcRows.length;

      const engagementRate =
        totalViews > 0
          ? ((totalClicks + totalPlays + totalQrScans) / totalViews) * 100
          : 0;

      // growth vs previous day (your frontend does similar)
      let growthPct = 0;
      if (series.length >= 2) {
        const last = series[series.length - 1]?.views || 0;
        const prev = series[series.length - 2]?.views || 0;
        if (prev > 0) {
          growthPct = ((last - prev) / prev) * 100;
        } else if (last > 0) {
          growthPct = 100;
        }
      }

      // build insights (simple, safe)
      const muse = buildMuseInsights({
        totals: {
          views: pvRows.length,
          clicks: lcRows.length,
          plays: totalPlays,
          songPlays: totalSongPlays,
          videoPlays: totalVideoPlays,
          qrScans: totalQrScans,
        },
        series,
        sources,
      });

      // external placeholder (for Phase 3)
      const external = {
        spotify: { streams: 0, listeners: 0 },
        youtube: { views: 0, watchTime: 0 },
      };

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
          qrScans: totalQrScans,
        },
        sources,
        mediums,
        refDomains,
        devices,
        platforms,
        mediaTypes,
        series,
        muse: {
          insights: muse,
        },
        external: {
          spotify: { streams: 0, listeners: 0 },
          youtube: { views: 0, watchTime: 0 },
        },
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
      const from = now
        .minus({ days: days - 1 })
        .startOf("day")
        .toISO();
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
      const list = Object.values(map)
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);

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
      const from = now
        .minus({ days: days - 1 })
        .startOf("day")
        .toISO();
      const to = now.endOf("day").toISO();

      const filters = {
        band: { id: bandId },
        [fieldTS]: { $gte: from, $lte: to },
      };

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
