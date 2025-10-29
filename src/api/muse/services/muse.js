'use strict';

const { DateTime } = require('luxon');

const UID_PV = 'api::band-page-view.band-page-view';
const UID_LC = 'api::link-click.link-click';
const UID_MP = 'api::media-play.media-play';
const UID_DI = 'api::band-insight-daily.band-insight-daily';

const FIELD_TS = 'timestamp';

const deviceOf = (ua = '') => {
  const s = String(ua || '').toLowerCase();
  if (!s) return 'unknown';
  if (/bot|crawl|spider|slurp|headless|preview|bingpreview/.test(s)) return 'bot';
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/android/.test(s) && !/mobile/.test(s)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile/.test(s)) return 'mobile';
  return 'desktop';
};

const aggSorted = (rows, pick, topN = 10) => {
  const m = {};
  for (const r of rows) {
    const raw = pick(r);
    const k = (raw || 'unknown').toString().toLowerCase();
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, topN);
};

module.exports = () => ({

  // ---------------- PHASE 1 ----------------
  async computeDay({ bandId, day }) {
    if (!bandId) throw new Error('bandId required');

    const d = day
      ? DateTime.fromISO(`${day}T00:00:00`, { zone: 'utc' })
      : DateTime.utc().minus({ days: 1 }).startOf('day');
    if (!d.isValid) throw new Error('Invalid day');

    const start = d.startOf('day').toISO();
    const end   = d.endOf('day').toISO();
    const dateKey = d.toISODate();

    const filters = { band: { id: bandId }, [FIELD_TS]: { $gte: start, $lte: end } };

    // ---------- PAGE VIEWS ----------
    const pvRows = await strapi.entityService.findMany(UID_PV, {
      filters,
      fields: ['id', FIELD_TS, 'userAgent', 'city', 'refSource', 'refMedium', 'refDomain'],
      pagination: { limit: 100000 },
    });

    const pageViews = pvRows.length;
    const uniqueIps = pageViews; // fallback

    let deviceDesktop = 0, deviceMobile = 0, deviceTablet = 0;
    for (const r of pvRows) {
      const k = deviceOf(r.userAgent);
      if (k === 'desktop') deviceDesktop++;
      else if (k === 'mobile') deviceMobile++;
      else if (k === 'tablet') deviceTablet++;
    }

    const cityMap = {};
    for (const r of pvRows) {
      const c = r.city || 'Unknown';
      cityMap[c] = (cityMap[c] || 0) + 1;
    }
    const topCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const sources    = aggSorted(pvRows, r => r.refSource, 20);
    const mediums    = aggSorted(pvRows, r => r.refMedium, 20);
    const refDomains = aggSorted(pvRows, r => r.refDomain, 20);

    // ---------- LINK CLICKS ----------
    const lcRows = await strapi.entityService.findMany(UID_LC, {
      filters,
      fields: ['id', FIELD_TS, 'clickCount', 'platform'],
      pagination: { limit: 100000 },
    });

    let linkClicks = 0;
    const platformMap = {};
    for (const r of lcRows) {
      const plat = (r.platform ?? 'unknown').toString().toLowerCase();
      const w = Number.isFinite(r.clickCount) ? Number(r.clickCount) : 1;
      linkClicks += w;
      platformMap[plat] = (platformMap[plat] || 0) + w;
    }

    const topLinks = [];
    const platforms = Object.entries(platformMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // ---------- MEDIA PLAYS ----------
    const mpRows = await strapi.entityService.findMany(UID_MP, {
      filters,
      fields: ['id', FIELD_TS, 'mediaType'],
      pagination: { limit: 100000 },
    });

    let songPlays = 0, videoPlays = 0;
    for (const r of mpRows) {
      const k = String(r.mediaType ?? '').toLowerCase();
      if (k.includes('video') || k.includes('youtube') || k.includes('mp4')) videoPlays++;
      else songPlays++;
    }

    // ---------- GROWTH ----------
    const prev = d.minus({ days: 1 });
    const prevViews = await strapi.entityService.count(UID_PV, {
      filters: { band: { id: bandId }, [FIELD_TS]: { $gte: prev.startOf('day').toISO(), $lte: prev.endOf('day').toISO() } },
    });

    let growthPct = 0;
    if (prevViews > 0) growthPct = Math.round(((pageViews - prevViews) / prevViews) * 1000) / 10;
    else if (pageViews > 0) growthPct = 100;

    // ---------- UPSERT ----------
    const key = `${bandId}:${dateKey}`;
    const nowISO = DateTime.utc().toISO();

    const data = {
      key,
      date: dateKey,
      band: bandId,
      pageViews,
      uniqueIps,
      linkClicks,
      songPlays,
      videoPlays,
      deviceDesktop,
      deviceMobile,
      deviceTablet,
      topCities,
      topLinks,
      sources,
      mediums,
      refDomains,
      platforms,
      growthPct,
      lastUpdated: nowISO,
    };

    const existing = await strapi.entityService.findMany(UID_DI, {
      filters: { key },
      fields: ['id'],
      pagination: { limit: 1 },
    });

    let saved;
    if (existing?.length) {
      saved = await strapi.entityService.update(UID_DI, existing[0].id, { data });
    } else {
      saved = await strapi.entityService.create(UID_DI, { data });
    }

    return { ok: true, bandId, date: dateKey, savedId: saved.id };
  },

  async backfillRange({ bandId, from, to }) {
    if (!bandId) throw new Error('bandId required');
    const start = DateTime.fromISO(`${from}T00:00:00`, { zone: 'utc' });
    const end   = DateTime.fromISO(`${to}T00:00:00`,   { zone: 'utc' });
    if (!start.isValid || !end.isValid || end < start) throw new Error('Invalid range');

    const days = Math.round(end.diff(start, 'days').days);
    const results = [];
    for (let i = 0; i <= days; i++) {
      const day = start.plus({ days: i }).toISODate();
      const r = await this.computeDay({ bandId, day });
      results.push(r);
    }
    return { ok: true, count: results.length, results };
  },

  // ---------------- PHASE 2.5 ----------------
  async aggregateSummary({ bandId, range = '7d' }) {
    const days = Number(range.replace('d', '')) || 7;
    const now = DateTime.utc();
    const from = now.minus({ days: days - 1 }).startOf('day');
    const to   = now.endOf('day');

    const rows = await strapi.entityService.findMany(UID_DI, {
      filters: { band: { id: bandId }, date: { $gte: from.toISO(), $lte: to.toISO() } },
      fields: [
        'date', 'pageViews', 'linkClicks', 'songPlays', 'videoPlays',
        'growthPct', 'topCities', 'sources', 'mediums', 'platforms'
      ],
      sort: ['date:asc'],
      pagination: { limit: 1000 },
    });

    if (!rows.length) return { ok: true, bandId, range, summary: null };

    // --- Totals ---
    const totalViews  = rows.reduce((s, r) => s + (r.pageViews || 0), 0);
    const totalClicks = rows.reduce((s, r) => s + (r.linkClicks || 0), 0);
    const totalSongs  = rows.reduce((s, r) => s + (r.songPlays || 0), 0);
    const totalVideos = rows.reduce((s, r) => s + (r.videoPlays || 0), 0);
    const avgGrowth   = Math.round(
      rows.reduce((s, r) => s + (r.growthPct || 0), 0) / rows.length * 10
    ) / 10;

    // --- Engagement rate ---
    const engagementRate = totalViews > 0
      ? Math.round(((totalClicks + totalSongs + totalVideos) / totalViews) * 1000) / 10
      : 0;

    // --- Previous period comparison ---
    const prevStart = from.minus({ days });
    const prevEnd = from.minus({ days: 1 });
    const prevRows = await strapi.entityService.findMany(UID_DI, {
      filters: { band: { id: bandId }, date: { $gte: prevStart.toISODate(), $lte: prevEnd.toISODate() } },
      fields: ['pageViews'],
      pagination: { limit: 1000 },
    });
    const prevViews = prevRows.reduce((s, r) => s + (r.pageViews || 0), 0);
    const prevComparison = prevViews > 0
      ? Math.round(((totalViews - prevViews) / prevViews) * 1000) / 10
      : (totalViews > 0 ? 100 : 0);

    // --- Top aggregations ---
    const mergeTop = (acc, list) => {
      (list || []).forEach(([key, count]) => {
        const k = (key || 'unknown').toLowerCase();
        acc[k] = (acc[k] || 0) + count;
      });
      return acc;
    };

    const cityAgg = rows.reduce((m, r) => mergeTop(m, r.topCities), {});
    const srcAgg  = rows.reduce((m, r) => mergeTop(m, r.sources), {});
    const platAgg = rows.reduce((m, r) => mergeTop(m, r.platforms), {});

    const topCities    = Object.entries(cityAgg).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const topSources   = Object.entries(srcAgg).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const topPlatforms = Object.entries(platAgg).sort((a,b)=>b[1]-a[1]).slice(0,3);

    const summary = {
      pageViews: totalViews,
      linkClicks: totalClicks,
      songPlays: totalSongs,
      videoPlays: totalVideos,
      engagementRate,
      growthPct: avgGrowth,
      prevComparison,
      topCities,
      topSources,
      topPlatforms,
      days,
    };

    return { ok: true, bandId, range, summary };
  },
});
