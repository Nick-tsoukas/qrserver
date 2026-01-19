"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/band-insights-daily/compute",
      handler: "band-insight-daily.compute",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/muse",
      handler: "band-insight-daily.muse",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/band-insights-daily/debug",
      handler: "band-insight-daily.debug",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/muse/backfill",
      handler: "band-insight-daily.backfill",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/muse/insights",
      handler: "band-insight-daily.insightsV2",
      config: { auth: false },
    },
  ],
};
