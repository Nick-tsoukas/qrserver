"use strict";
const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::band-insight-daily.band-insight-daily", ({ strapi }) => ({
  async computeDay({ bandId, day }) {
    if (!bandId) throw new Error("bandId is required");

    // ---- set your UIDs here (match your CTs) ----
    const UID_PV = "api::band-page-view.band-page-view"; // page views CT UID
    const UID_LC = "api::link-click.link-click";         // link clicks CT UID
    const UID_MP = "api::media-play.media-play";         // media plays CT UID
    const TS_FIELD = "createdAt";                        // Strapi default; change if you added a custom timestamp

    // ---- UTC window for the given day ----
    const d = typeof day === "string" ? new Date(day + "T00:00:00Z") : (day || new Date());
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const to   = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const dateWhere = { $gte: from, $lt: to };

    // ---------------- PAGE VIEWS ----------------
const baseWhere = { band: { id: bandId }, [TS_FIELD]: dateWhere };

const pvRows = await strapi.db.query(UID_PV).findMany({
  where: baseWhere,
  limit: 100000,
});

    const deviceOf = (ua = "") => {
      const s = String(ua).toLowerCase();
      if (!s) return "unknown";
      if (/bot|crawl|spider|slurp|headless|preview/.test(s)) return "bot";
      if (/ipad|tablet/.test(s)) return "tablet";
      if (/android/.test(s) && !/mobile/.test(s)) return "tablet";
      if (/mobile|iphone|ipod|android.*mobile/.test(s)) return "mobile";
      return "desktop";
    };

    const pageViews = pvRows.length;
    const ipSet = new Set();
    let deviceDesktop = 0, deviceMobile = 0, deviceTablet = 0;
    const cityCounts = {};
    for (const r of pvRows) {
      const ip   = r.ipAddress ?? r.ip_address ?? r.ip ?? null;
      const ua   = r.userAgent ?? r.user_agent ?? r.ua ?? "";
      const city = r.city ?? r.geoCity ?? r.location_city ?? "Unknown";
      if (ip) ipSet.add(ip);
      const dd = deviceOf(ua);
      if (dd === "desktop") deviceDesktop++;
      else if (dd === "mobile") deviceMobile++;
      else if (dd === "tablet") deviceTablet++;
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
    const uniqueIps = ipSet.size;
    const topCities = Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);

    // ---------------- LINK CLICKS ----------------
  const linkClicks = await strapi.db.query(UID_LC).count({
  where: baseWhere,
});

const mpRows = await strapi.db.query(UID_MP).findMany({
  where: baseWhere,
  limit: 100000,
});

    const takeType = (row) => String(row.mediaType ?? row.media_type ?? "").toLowerCase();
    const songPlays  = mpRows.filter(m => takeType(m) === "song").length;
    const videoPlays = mpRows.filter(m => takeType(m) === "video").length;

    // ------------- GROWTH VS YESTERDAY ----------
    const yFrom = new Date(from.getTime() - 24*60*60*1000);
    const yTo   = from;
  const yCount = await strapi.db.query(UID_PV).count({
  where: { band: { id: bandId }, [TS_FIELD]: { $gte: yFrom, $lt: yTo } },
});
    const growthPct = yCount ? ((pageViews - yCount) / yCount) * 100 : 0;

    // ---------------- UPSERT INSIGHT ------------
    const dayStr = from.toISOString().slice(0,10);
    const key = `${bandId}:${dayStr}`;

    const existing = await strapi.entityService.findMany(
      "api::band-insight-daily.band-insight-daily",
      { filters: { key }, fields: ["id"] }
    );

    const payload = {
      key,
      date: dayStr,
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
      growthPct,
      lastUpdated: new Date(),
    };

    if (existing?.length) {
      return await strapi.entityService.update(
        "api::band-insight-daily.band-insight-daily",
        existing[0].id,
        { data: payload }
      );
    } else {
      return await strapi.entityService.create(
        "api::band-insight-daily.band-insight-daily",
        { data: payload }
      );
    }
  },
  async generateMuse({ bandId, days = 30 }) {
  // 1) fetch recent daily rows
  const rows = await strapi.entityService.findMany(
    'api::band-insight-daily.band-insight-daily',
    {
      filters: { band: { id: bandId } },
      sort: ['date:desc'],
      pagination: { limit: days },
    }
  );

  const d = rows.map(r => r); // already plain enough from entityService

  const sum = (arr, pick) => arr.reduce((a, x) => a + (pick(x) || 0), 0);
  const pct = (a,b) => b ? ((a-b)/b)*100 : 0;
  const take = (n, arr) => arr.slice(0, n);

  const last7 = take(7, d);
  const prev7 = d.slice(7, 14);
  const today = d[0];
  const yday  = d[1];

  const pv7 = sum(last7, r => r.pageViews);
  const pvPrev7 = sum(prev7, r => r.pageViews);

  // simple insights
  const insights = [];

  if (today) {
    const pvToday   = today.pageViews || 0;
    const pvYday    = yday?.pageViews || 0;
    const deltaDay  = pct(pvToday, pvYday);
    insights.push({
      title: 'Traffic vs Yesterday',
      value: `${pvToday} views`,
      delta: isFinite(deltaDay) ? deltaDay : null,
      hint: yday ? `Yesterday ${pvYday}` : 'No prior day',
      kind: 'momentum-day',
    });
  }

  if (last7.length && prev7.length) {
    const delta7 = pct(pv7, pvPrev7);
    insights.push({
      title: '7-Day Momentum',
      value: `${pv7} views`,
      delta: isFinite(delta7) ? delta7 : null,
      hint: `Prev 7d ${pvPrev7}`,
      kind: 'momentum-week',
    });
  }

  const clicks7 = sum(last7, r => r.linkClicks);
  if (pv7 > 0) {
    const ctr = (clicks7 / pv7) * 100;
    insights.push({
      title: 'Click-Through Rate',
      value: `${ctr.toFixed(1)}%`,
      delta: null,
      hint: `${clicks7} clicks / ${pv7} views (7d)`,
      kind: 'ctr',
    });
  }

  const songs7 = sum(last7, r => r.songPlays);
  const videos7 = sum(last7, r => r.videoPlays);
  if (pv7 > 0) {
    insights.push({
      title: 'Engagement Mix',
      value: `${(songs7/pv7*100).toFixed(1)} song & ${(videos7/pv7*100).toFixed(1)} video plays /100 views`,
      delta: null,
      hint: `${songs7} songs, ${videos7} videos (7d)`,
      kind: 'mix',
    });
  }

  if (today) {
    const totalDev = (today.deviceDesktop || 0) + (today.deviceMobile || 0) + (today.deviceTablet || 0);
    if (totalDev > 0) {
      const mobileShare = (today.deviceMobile || 0) / totalDev * 100;
      if (mobileShare >= 70) {
        insights.push({
          title: 'Mobile-first Audience',
          value: `${mobileShare.toFixed(0)}% mobile`,
          delta: null,
          hint: 'Optimize above-the-fold CTA, reduce heavy embeds.',
          kind: 'device',
        });
      }
    }

    const topCity = Array.isArray(today.topCities) && today.topCities.length ? (today.topCities[0][0] || 'Unknown') : null;
    if (topCity) {
      insights.push({
        title: 'Top City Today',
        value: topCity,
        delta: null,
        hint: 'Consider geo-targeting this city.',
        kind: 'city',
      });
    }
  }

  return insights.slice(0, 5);
}

}));
